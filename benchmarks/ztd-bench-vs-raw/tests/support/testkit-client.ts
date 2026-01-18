import fs from 'node:fs';
import path from 'node:path';
import { types } from 'pg';
import type { QueryResultRow } from 'pg';
import { createPgTestkitClient } from '@rawsql-ts/adapter-node-pg';
import type { PgQueryInput, PgQueryable } from '@rawsql-ts/adapter-node-pg';
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
  migrationMs?: number;
  cleanupMs?: number;
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
  // Wrap the raw client so the adapter sees the minimal PgQueryable surface.
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

export type ZtdExecutionMode = 'ztd' | 'traditional';

type ZtdSqlLogPhase = 'original' | 'rewritten';

type ZtdSqlLogEvent = {
  kind: 'ztd-sql';
  phase: ZtdSqlLogPhase;
  queryId: number;
  sql: string;
  params?: unknown[];
  fixturesApplied?: string[];
  timestamp: string;
};

type ZtdProfilePhase = 'connection' | 'setup' | 'query' | 'teardown';

type ZtdProfileEvent = {
  kind: 'ztd-profile';
  phase: ZtdProfilePhase;
  testName?: string;
  workerId?: string;
  processId: number;
  executionMode?: 'serial' | 'parallel' | 'unknown';
  connectionReused?: boolean;
  queryId?: number;
  queryCount?: number;
  durationMs?: number;
  totalQueryMs?: number;
  sql?: string;
  params?: unknown[];
  fixturesApplied?: string[];
  sampleSql?: string[];
  timestamp: string;
};

type ZtdProfileOptions = {
  enabled?: boolean;
  perQuery?: boolean;
  includeParams?: boolean;
  includeSql?: boolean;
  sampleLimit?: number;
  testName?: string;
  executionMode?: 'serial' | 'parallel' | 'unknown';
  logger?: (event: ZtdProfileEvent) => void;
};

type ZtdSqlLogOptions = {
  enabled?: boolean;
  includeParams?: boolean;
  logger?: (event: ZtdSqlLogEvent) => void;
  profile?: ZtdProfileOptions;
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
  executionMode?: ZtdExecutionMode;
  logOptions?: ZtdSqlLogOptions;
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
  logOptions,
} = options;
  const metricsPath = resolveMetricsPath();
  const sqlLogPath = resolveSqlLogPath();
  const sqlLogStream = sqlLogPath ? fs.createWriteStream(sqlLogPath, { flags: 'a' }) : undefined;
  const executionMode = resolveExecutionMode(options.executionMode);
  const loggingState = buildLoggingState(logOptions);
  const {
    logEnabled,
    logParams,
    logSink,
    profileEnabled,
    profilePerQuery,
    profileParams,
    profileIncludeSql,
    profileSampleLimit,
    profileTestName,
    profileExecutionMode,
    profileWorkerId,
    profileSink,
  } = loggingState;

  const benchContext: BenchContext = {
    scenario: scenarioLabel,
    mode,
    phase,
    suiteMultiplier,
    runIndex,
    caseName,
    workerId,
    parallelWorkerCount,
    approach: executionMode,
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
  if (executionMode === 'traditional') {
    return createTraditionalPgTestkitClient({
      fixtures,
      schemaName,
      metricsCollector,
      benchContext,
      logEnabled,
      logParams,
      logSink,
      profileEnabled,
      profilePerQuery,
      profileParams,
      profileIncludeSql,
      profileSampleLimit,
      profileTestName,
      profileExecutionMode,
      profileWorkerId,
      profileSink,
      metricsPath,
      sqlLogStream,
      queryable,
      release,
      scenarioLabel,
      mode,
      workerId,
      caseName,
      suiteMultiplier,
      runIndex,
      phase,
      parallelWorkerCount,
      connectionModel,
      dbConcurrencyMode,
    });
  }
  const metrics: ZtdBenchMetrics = {
    sqlCount: 0,
    totalDbMs: 0,
    totalQueryMs: 0,
    rewriteMs: 0,
    fixtureMaterializationMs: 0,
    sqlGenerationMs: 0,
    otherProcessingMs: 0,
    migrationMs: 0,
    cleanupMs: 0,
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
          migrationMs: (existing.migrationMs ?? 0) + (metrics.migrationMs ?? 0),
          cleanupMs: (existing.cleanupMs ?? 0) + (metrics.cleanupMs ?? 0),
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
      migrationMs: 0,
      cleanupMs: 0,
    };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as ZtdBenchMetrics;
}

function buildLoggingState(options: ZtdSqlLogOptions = {}) {
  // Determine SQL logging controls from explicit overrides before falling back to environment flags.
  const logEnabled = options.enabled ?? isTruthyEnv(process.env.ZTD_SQL_LOG);
  const logParams = options.includeParams ?? isTruthyEnv(process.env.ZTD_SQL_LOG_PARAMS);
  const logSink =
    options.logger ??
    ((event: ZtdSqlLogEvent) => {
      console.log(safeJsonStringify(event));
    });

  // Derive profiling behavior from nested options or environment defaults.
  const profileOptions = options.profile ?? {};
  const profileEnabled = profileOptions.enabled ?? isTruthyEnv(process.env.ZTD_PROFILE);
  const profilePerQuery = profileOptions.perQuery ?? isTruthyEnv(process.env.ZTD_PROFILE_PER_QUERY);
  const profileParams = profileOptions.includeParams ?? isTruthyEnv(process.env.ZTD_PROFILE_PARAMS);
  const profileIncludeSql = profileOptions.includeSql ?? isTruthyEnv(process.env.ZTD_PROFILE_SQL);
  const profileSampleLimit =
    profileOptions.sampleLimit ?? resolveNumberEnv(process.env.ZTD_PROFILE_SAMPLE_LIMIT) ?? 5;
  const profileTestName = profileOptions.testName ?? process.env.ZTD_PROFILE_TEST_NAME;
  const profileExecutionMode =
    profileOptions.executionMode ??
    (process.env.ZTD_PROFILE_EXECUTION as 'serial' | 'parallel' | 'unknown' | undefined) ??
    (process.env.VITEST_WORKER_ID ? 'parallel' : 'serial');
  const profileWorkerId = process.env.VITEST_WORKER_ID ?? process.env.JEST_WORKER_ID;
  const profileSink =
    profileOptions.logger ??
    ((event: ZtdProfileEvent) => {
      console.log(safeJsonStringify(event));
    });

  return {
    logEnabled,
    logParams,
    logSink,
    profileEnabled,
    profilePerQuery,
    profileParams,
    profileIncludeSql,
    profileSampleLimit,
    profileTestName,
    profileExecutionMode,
    profileWorkerId,
    profileSink,
  };
}

function resolveExecutionMode(mode?: ZtdExecutionMode): ZtdExecutionMode {
  if (mode === 'traditional') {
    return 'traditional';
  }

  const envMode = process.env.ZTD_EXECUTION_MODE as ZtdExecutionMode | undefined;
  return envMode === 'traditional' ? 'traditional' : 'ztd';
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function resolveNumberEnv(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, item) => {
    // Avoid BigInt serialization issues and circular references when emitting JSON.
    if (typeof item === 'bigint') {
      return item.toString();
    }

    if (typeof item === 'object' && item !== null) {
      if (seen.has(item)) {
        return '[Circular]';
      }
      seen.add(item);
    }

    return item;
  });
}

async function applySqlFiles(client: PgQueryable, directories: string[]): Promise<void> {
  for (const directory of directories) {
    if (!fs.existsSync(directory)) {
      continue;
    }
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.sql')) {
        continue;
      }
      const filePath = path.join(directory, entry.name);
      const sql = await fs.promises.readFile(filePath, 'utf8');
      if (!sql.trim()) {
        continue;
      }
      await client.query(sql);
    }
  }
}

async function seedFixtureRows(client: PgQueryable, fixtures: TableFixture[], isolationSchema?: string): Promise<void> {
  for (const fixture of fixtures) {
    if (fixture.rows.length === 0) {
      continue;
    }
    const columnNames = getColumnNamesFromFixture(fixture);
    if (columnNames.length === 0) {
      continue;
    }
    const tableIdentifier = buildTableIdentifier(fixture.tableName, isolationSchema);
    const columnsSql = columnNames.map((column) => quoteIdentifier(column)).join(', ');
    for (const row of fixture.rows) {
      const values = columnNames.map((column) =>
        Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null,
      );
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      await client.query(`INSERT INTO ${tableIdentifier} (${columnsSql}) VALUES (${placeholders})`, values);
    }
  }
}

function getColumnNamesFromFixture(fixture: TableFixture): string[] {
  if (fixture.schema && Array.isArray((fixture.schema as { columns?: unknown }).columns)) {
    return (fixture.schema as { columns: { name: string }[] }).columns.map((column) => column.name);
  }

  if (fixture.schema && 'columns' in fixture.schema && typeof fixture.schema.columns === 'object') {
    return Object.keys(fixture.schema.columns);
  }

  if (fixture.rows.length > 0) {
    return Object.keys(fixture.rows[0]);
  }

  return [];
}

function buildTableIdentifier(tableName: string, isolationSchema?: string): string {
  const segments = tableName.split('.');
  const baseTable = segments.length > 1 ? segments[segments.length - 1] : tableName;
  const schema = isolationSchema ?? (segments.length > 1 ? segments.slice(0, -1).join('.') : undefined);
  if (schema) {
    return `${quoteIdentifier(schema)}.${quoteIdentifier(baseTable)}`;
  }
  return quoteIdentifier(baseTable);
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function generateSchemaName(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return `ztd_traditional_${timestamp}_${random}`;
}

type TraditionalClientParams = {
  fixtures: TableFixture[];
  schemaName?: string;
  metricsCollector?: ZtdBenchMetricsCollector;
  benchContext: BenchContext;
  logEnabled: boolean;
  logParams: boolean;
  logSink: (event: ZtdSqlLogEvent) => void;
  profileEnabled: boolean;
  profilePerQuery: boolean;
  profileParams: boolean;
  profileIncludeSql: boolean;
  profileSampleLimit: number;
  profileTestName?: string;
  profileExecutionMode?: 'serial' | 'parallel' | 'unknown';
  profileWorkerId?: string;
  profileSink: (event: ZtdProfileEvent) => void;
  metricsPath?: string;
  sqlLogStream?: fs.WriteStream;
  queryable: PgQueryable;
  release: () => Promise<void>;
  scenarioLabel: string;
  mode: ModeLabel;
  workerId?: string;
  caseName?: string;
  suiteMultiplier: number;
  runIndex: number;
  phase: RunPhase;
  parallelWorkerCount: number;
  connectionModel: ConnectionModel;
  dbConcurrencyMode: DbConcurrencyMode;
};

function createTraditionalPgTestkitClient(params: TraditionalClientParams): ZtdPlaygroundClient {
  const {
    fixtures,
    schemaName,
    metricsCollector,
    benchContext,
    logEnabled,
    logParams,
    logSink,
    profileEnabled,
    profilePerQuery,
    profileParams,
    profileIncludeSql,
    profileSampleLimit,
    profileTestName,
    profileExecutionMode,
    profileWorkerId,
    profileSink,
    metricsPath,
    sqlLogStream,
    queryable,
    release,
  } = params;
  const resolvedSchemaName = schemaName ?? generateSchemaName();
  const connectionStartedAt = profileEnabled ? Date.now() : 0;
  if (profileEnabled) {
    profileSink({
      kind: 'ztd-profile',
      phase: 'connection',
      testName: profileTestName,
      workerId: profileWorkerId,
      processId: process.pid,
      executionMode: profileExecutionMode,
      connectionReused: false,
      durationMs: Date.now() - connectionStartedAt,
      timestamp: new Date().toISOString(),
    });
  }

  let initializationPromise: Promise<void> | null = null;
  const setupStartedAt = Date.now();
  let setupLogged = false;

  const metrics: ZtdBenchMetrics = {
    sqlCount: 0,
    totalDbMs: 0,
    totalQueryMs: 0,
    rewriteMs: 0,
    fixtureMaterializationMs: 0,
    sqlGenerationMs: 0,
    otherProcessingMs: 0,
    migrationMs: 0,
    cleanupMs: 0,
  };

  const profileStats = {
    queryCount: 0,
    totalQueryMs: 0,
    sampleSql: [] as string[],
  };
  const queryIdStack: number[] = [];
  let nextQueryId = 1;
  let dbExecutionStarted = false;

  const ensureInitialized = (): Promise<void> => {
    if (!initializationPromise) {
      initializationPromise = (async () => {
        if (resolvedSchemaName) {
          await queryable.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(resolvedSchemaName)}`);
          await queryable.query(
            `SET search_path TO ${quoteIdentifier(resolvedSchemaName)}, public`,
          );
        }
        await applySqlFiles(queryable, ddlDirectories);
        const fixtureStart = process.hrtime.bigint();
        await seedFixtureRows(queryable, fixtures, resolvedSchemaName);
        metrics.fixtureMaterializationMs = Number(process.hrtime.bigint() - fixtureStart) / 1_000_000;
      })().then(() => {
        const setupDurationMs = Date.now() - setupStartedAt;
        metrics.migrationMs = setupDurationMs;
        if (metrics.fixtureMaterializationMs === 0) {
          metrics.fixtureMaterializationMs = setupDurationMs;
        }
        if (profileEnabled && !setupLogged) {
          profileSink({
            kind: 'ztd-profile',
            phase: 'setup',
            testName: profileTestName,
            workerId: profileWorkerId,
            processId: process.pid,
            executionMode: profileExecutionMode,
            durationMs: setupDurationMs,
            timestamp: new Date().toISOString(),
            queryCount: profileStats.queryCount,
          });
          setupLogged = true;
        }
      });
    }
    return initializationPromise;
  };

  return {
    async query<T extends QueryResultRow>(text: string, values?: unknown[]) {
      const queryId = nextQueryId++;
      queryIdStack.push(queryId);
      if (logEnabled) {
        logSink({
          kind: 'ztd-sql',
          phase: 'original',
          queryId,
          sql: text,
          params: logParams ? values : undefined,
          timestamp: new Date().toISOString(),
        });
      }
      const queryStartedAt = profileEnabled ? Date.now() : 0;
      if (!dbExecutionStarted) {
        dbExecutionStarted = true;
        logBenchPhase('db-execution', 'start', benchContext);
      }
      await ensureInitialized();
      const startedAt = process.hrtime.bigint();
      const result = await queryable.query<T>(text, values);
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      metrics.sqlCount += 1;
      metrics.totalDbMs += durationMs;
      metrics.totalQueryMs += durationMs;

      if (profileEnabled) {
        const duration = Date.now() - queryStartedAt;
        profileStats.queryCount += 1;
        profileStats.totalQueryMs += duration;

        if (profileIncludeSql && profileStats.sampleSql.length < profileSampleLimit) {
          profileStats.sampleSql.push(text);
        }

        if (profilePerQuery) {
          profileSink({
            kind: 'ztd-profile',
            phase: 'query',
            testName: profileTestName,
            workerId: profileWorkerId,
            processId: process.pid,
            executionMode: profileExecutionMode,
            queryId,
            durationMs: duration,
            sql: profileIncludeSql ? text : undefined,
            params: profileParams ? values : undefined,
            timestamp: new Date().toISOString(),
          });
        }
      }
      queryIdStack.pop();
      return result.rows;
    },
    async close() {
      const teardownStartedAt = profileEnabled ? Date.now() : 0;
      let teardownError: unknown;
      try {
        if (initializationPromise) {
          await initializationPromise.catch(() => undefined);
        }
        const cleanupStart = profileEnabled ? Date.now() : 0;
        if (resolvedSchemaName) {
          await queryable.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(resolvedSchemaName)} CASCADE`);
        }
        metrics.cleanupMs = profileEnabled ? Date.now() - cleanupStart : 0;
      } catch (error) {
        teardownError = error;
      } finally {
        if (profileEnabled) {
          profileSink({
            kind: 'ztd-profile',
            phase: 'teardown',
            testName: profileTestName,
            workerId: profileWorkerId,
            processId: process.pid,
            executionMode: profileExecutionMode,
            durationMs: Date.now() - teardownStartedAt,
            queryCount: profileStats.queryCount,
            totalQueryMs: profileStats.totalQueryMs,
            sampleSql: profileIncludeSql ? profileStats.sampleSql : undefined,
            timestamp: new Date().toISOString(),
          });
        }
        if (teardownError) {
          try {
            await release();
          } catch (releaseError) {
            console.error(releaseError);
          }
          throw teardownError;
        }
      }

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
          migrationMs: (existing.migrationMs ?? 0) + (metrics.migrationMs ?? 0),
          cleanupMs: (existing.cleanupMs ?? 0) + (metrics.cleanupMs ?? 0),
        };
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
