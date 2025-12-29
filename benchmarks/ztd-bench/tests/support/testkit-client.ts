import fs from 'node:fs';
import path from 'node:path';
import { types } from 'pg';
import type { QueryResultRow } from 'pg';
import { createPgTestkitClient } from '@rawsql-ts/pg-testkit';
import type { PgQueryInput, PgQueryable } from '@rawsql-ts/pg-testkit';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import {
  ConnectionLogger,
  ConnectionModel,
  DbConcurrencyMode,
  ModeLabel,
  RunPhase,
} from './diagnostics';
import { appendWorkerTag } from '../../../support/worker-tag';
import { getDbClient } from '../../../support/db-client';
import { BenchContext, logBenchPhase } from '../../../support/benchmark-logger';
import { recordZtdWaiting } from './bench-diagnostics';

const ddlDirectories = [path.resolve(__dirname, '..', '..', 'ddl')];

export type ZtdBenchMetrics = {
  sqlCount: number;
  totalDbMs: number;
  totalQueryMs: number;
  rewriteMs: number;
  fixtureMaterializationMs: number;
  sqlGenerationMs: number;
  otherProcessingMs: number;
};

export type ZtdBenchMetricsCollector = (metrics: ZtdBenchMetrics) => void;

const { INT2, INT4, INT8, NUMERIC, DATE } = types.builtins;
const parseInteger = (value: string | null) => (value === null ? null : Number(value));
const parseNumeric = (value: string | null) => (value === null ? null : Number(value));

// Align pg parsers with the primitive shapes the fixtures assert in tests.
types.setTypeParser(INT2, parseInteger);
types.setTypeParser(INT4, parseInteger);
types.setTypeParser(INT8, parseInteger);
types.setTypeParser(NUMERIC, parseNumeric);
types.setTypeParser(DATE, (value) => value);

type AcquireOptions = {
  connectionModel: ConnectionModel;
  workerId?: string;
  applicationName: string;
  context?: BenchContext;
  dbConcurrencyMode?: DbConcurrencyMode;
};

async function acquireQueryable(options: AcquireOptions): Promise<{
  queryable: PgQueryable;
  pid: number;
  release: () => Promise<void>;
  acquireMs?: number;
}> {
  const { connectionModel, workerId, applicationName, context, dbConcurrencyMode } = options;
  // Force a shared scope when single-connection mode is requested.
  const scope =
    dbConcurrencyMode === 'single' ? 'shared' : connectionModel === 'perWorker' ? 'worker' : 'case';
  // Pull a client from the shared pool and keep the release hook for cleanup.
  logBenchPhase('connection', 'start', context ?? {}, {
    scope,
    workerId,
    applicationName,
  });
  const { client, pid, release, acquireMs } = await getDbClient({
    applicationName,
    context,
  });
  logBenchPhase('connection', 'end', context ?? {}, {
    scope,
    workerId,
    pid,
    applicationName,
  });
  // Wrap the raw client so pg-testkit sees the minimal PgQueryable surface.
  const queryable: PgQueryable = {
    query: <T extends QueryResultRow>(textOrConfig: PgQueryInput, values?: unknown[]) =>
      client.query<T>(textOrConfig as never, values),
    release: async () => {
      logBenchPhase('connection', 'start', context ?? {}, {
        scope,
        workerId,
        pid,
        applicationName,
      });
      await release();
      logBenchPhase('connection', 'end', context ?? {}, {
        scope,
        workerId,
        pid,
        applicationName,
      });
    },
  };
  return {
    queryable,
    pid,
    release,
    acquireMs,
  };
}

export type ZtdPlaygroundQueryResult<T extends QueryResultRow = QueryResultRow> = Promise<T[]>;

export type ZtdPlaygroundClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): ZtdPlaygroundQueryResult<T>;
  close(): Promise<void>;
};

type TestkitClientOptions = {
  schemaName?: string;
  metricsCollector?: ZtdBenchMetricsCollector;
  connectionModel?: ConnectionModel;
  connectionLogger?: ConnectionLogger;
  scenarioLabel?: string;
  mode?: ModeLabel;
  workerId?: string;
  caseName?: string;
  suiteMultiplier?: number;
  runIndex?: number;
  phase?: RunPhase;
  parallelWorkerCount?: number;
  applicationName?: string;
  dbConcurrencyMode?: DbConcurrencyMode;
};

export async function createTestkitClient(
  fixtures: TableFixture[],
  options: TestkitClientOptions = {},
): Promise<ZtdPlaygroundClient> {
  const {
    schemaName,
    metricsCollector,
    connectionModel = 'perWorker',
    connectionLogger,
    scenarioLabel = 'ztd',
    mode = 'serial',
    workerId,
    caseName,
    suiteMultiplier = 1,
    runIndex = 0,
    phase = 'measured',
    parallelWorkerCount = 1,
    applicationName,
    dbConcurrencyMode = 'single',
  } = options;
  const metricsPath = resolveMetricsPath();
  const sqlLogPath = resolveSqlLogPath();
  const sqlLogStream = sqlLogPath ? fs.createWriteStream(sqlLogPath, { flags: 'a' }) : undefined;

  const benchContext: BenchContext = {
    scenario: scenarioLabel,
    mode,
    phase,
    suiteMultiplier,
    runIndex,
    caseName,
    workerId,
    parallelWorkerCount,
    approach: 'ztd',
    connectionModel,
    dbConcurrencyMode,
  };

  const baseConnectionName = applicationName ?? `ztd-bench-${scenarioLabel}-${mode}`;
  const connectionAppName = appendWorkerTag(baseConnectionName, workerId);
  const { queryable, pid, release, acquireMs } = await acquireQueryable({
    connectionModel,
    workerId,
    applicationName: connectionAppName,
    context: benchContext,
    dbConcurrencyMode,
  });
  connectionLogger?.({
    scenarioLabel,
    mode,
    phase,
    suiteMultiplier,
    runIndex,
    workerId,
    caseName,
    pid,
    connectionModel,
    applicationName: connectionAppName,
    dbConcurrencyMode,
    workerCount: benchContext.parallelWorkerCount,
  });
  if (typeof acquireMs === 'number') {
    recordZtdWaiting(
      {
        scenario: scenarioLabel,
        connectionModel,
        mode,
        phase,
        suiteMultiplier,
        workerCount: parallelWorkerCount,
        dbConcurrencyMode,
      },
      acquireMs,
    );
  }
  const metrics: ZtdBenchMetrics = {
    sqlCount: 0,
    totalDbMs: 0,
    totalQueryMs: 0,
    rewriteMs: 0,
    fixtureMaterializationMs: 0,
    sqlGenerationMs: 0,
    otherProcessingMs: 0,
  };

  const queryStartTimes = new Map<number, number>();
  const queryIdStack: number[] = [];
  let nextQueryId = 1;
  let dbExecutionStarted = false;

  const instrumentedQueryable: PgQueryable = {
    query: async <T extends QueryResultRow>(textOrConfig: PgQueryInput, values?: unknown[]) => {
      if (!dbExecutionStarted) {
        dbExecutionStarted = true;
        logBenchPhase('db-execution', 'start', benchContext);
      }
      const startedAt = process.hrtime.bigint();
      metrics.sqlCount += 1;

      const sqlText = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
      if (sqlLogStream) {
        sqlLogStream.write(`${sqlText}\n`);
      }

      const result = await queryable.query<T>(textOrConfig as never, values);
      metrics.totalDbMs += Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      return result;
    },
    release: () => {
      // Release is intentionally a no-op because the per-worker client stays attached to the pool.
      return;
    },
  };

  // TableNameResolver keeps DDL and fixtures aligned on canonical schema-qualified identifiers like 'public.customer'.
  const fixtureStart = process.hrtime.bigint();
  logBenchPhase('rewrite-fixture', 'start', benchContext);
  const driver = createPgTestkitClient({
    connectionFactory: () => instrumentedQueryable,
    tableRows: fixtures,
    ddl: { directories: ddlDirectories },
    ...(schemaName
      ? {
          // Keep DDL + fixture resolution scoped to a unique schema per benchmark repetition.
          defaultSchema: schemaName,
          searchPath: [schemaName],
        }
      : {}),
    onExecute: (_rewrittenSql, _params, _fixturesApplied) => {
      // Record rewrite completion time for the active query.
      const activeQueryId = queryIdStack.at(-1);
      if (typeof activeQueryId !== 'number') {
        return;
      }
      const startedAt = queryStartTimes.get(activeQueryId);
      if (typeof startedAt === 'number') {
        metrics.rewriteMs += Date.now() - startedAt;
      }
    },
  });
  metrics.fixtureMaterializationMs = Number(process.hrtime.bigint() - fixtureStart) / 1_000_000;
  logBenchPhase('rewrite-fixture', 'end', benchContext, {
    fixtureMs: metrics.fixtureMaterializationMs,
    rewriteMs: metrics.rewriteMs,
    sqlGenerationMs: metrics.sqlGenerationMs,
  });

  // Expose a simplified query API so tests can assert on plain row arrays.
  return {
    async query<T extends QueryResultRow>(text: string, values?: unknown[]) {
      const queryId = nextQueryId++;
      queryStartTimes.set(queryId, Date.now());
      queryIdStack.push(queryId);

      const startedAt = process.hrtime.bigint();
      const result = await driver.query<T>(text, values);
      metrics.totalQueryMs += Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      queryStartTimes.delete(queryId);
      queryIdStack.pop();
      return result.rows;
    },
    async close() {
      await driver.close();

      metrics.otherProcessingMs = Math.max(
        0,
        metrics.totalQueryMs - metrics.totalDbMs - metrics.rewriteMs - metrics.sqlGenerationMs,
      );

      metricsCollector?.({ ...metrics });

      if (metricsPath) {
        const existing = readExistingMetrics(metricsPath);
        const combined: ZtdBenchMetrics = {
          sqlCount: existing.sqlCount + metrics.sqlCount,
          totalDbMs: existing.totalDbMs + metrics.totalDbMs,
          totalQueryMs: existing.totalQueryMs + metrics.totalQueryMs,
          rewriteMs: existing.rewriteMs + metrics.rewriteMs,
          fixtureMaterializationMs:
            existing.fixtureMaterializationMs + metrics.fixtureMaterializationMs,
          sqlGenerationMs: existing.sqlGenerationMs + metrics.sqlGenerationMs,
          otherProcessingMs: existing.otherProcessingMs + metrics.otherProcessingMs,
        };
        // Recompute otherProcessingMs after aggregation to keep totals consistent.
        combined.otherProcessingMs = Math.max(
          0,
          combined.totalQueryMs - combined.totalDbMs - combined.rewriteMs - combined.sqlGenerationMs,
        );
        fs.writeFileSync(metricsPath, JSON.stringify(combined, null, 2), 'utf8');
      }

      if (sqlLogStream) {
        sqlLogStream.end();
      }
      logBenchPhase('db-execution', 'end', benchContext, {
        dbMs: metrics.totalDbMs,
        sqlCount: metrics.sqlCount,
      });
      logBenchPhase('releaseClient', 'start', benchContext);
      await release();
      logBenchPhase('releaseClient', 'end', benchContext);
    },
  };
}

function resolveMetricsPath(): string | undefined {
  const prefix = process.env.ZTD_BENCH_METRICS_PREFIX;
  if (!prefix) {
    return undefined;
  }

  const workerToken = process.env.VITEST_WORKER_ID ?? process.pid.toString();
  return `${prefix}-${workerToken}.json`;
}

function resolveSqlLogPath(): string | undefined {
  const prefix = process.env.ZTD_BENCH_SQL_LOG_PREFIX;
  if (!prefix) {
    return undefined;
  }

  const workerToken = process.env.VITEST_WORKER_ID ?? process.pid.toString();
  return `${prefix}-${workerToken}.log`;
}

function readExistingMetrics(filePath: string): ZtdBenchMetrics {
  if (!fs.existsSync(filePath)) {
    return {
      sqlCount: 0,
      totalDbMs: 0,
      totalQueryMs: 0,
      rewriteMs: 0,
      fixtureMaterializationMs: 0,
      sqlGenerationMs: 0,
      otherProcessingMs: 0,
    };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as ZtdBenchMetrics;
}
