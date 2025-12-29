// ZTD testkit helper - AUTO GENERATED
// ztd-cli emits this file during project bootstrapping to wire pg-testkit.
// Regenerate via npx ztd init (choose overwrite when prompted); avoid manual edits.

import { existsSync, promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { Client, types } from 'pg';
import type { ClientConfig, QueryResultRow } from 'pg';
import { createPgTestkitClient } from '@rawsql-ts/pg-testkit';
import type { PgQueryInput, PgQueryable } from '@rawsql-ts/pg-testkit';
import type { TableFixture } from '@rawsql-ts/testkit-core';

const ddlDirectories = [path.resolve(__dirname, '../../ztd/ddl')];

let sharedPgClient: Client | undefined;
let sharedQueryable: PgQueryable | undefined;

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

export type ZtdExecutionMode = 'ztd' | 'traditional';

export type TraditionalIsolationMode = 'schema' | 'none';
export type TraditionalCleanupStrategy = 'drop_schema' | 'custom_sql' | 'none';

export interface TraditionalExecutionConfig {
  isolation?: TraditionalIsolationMode;
  setupSql?: string[];
  cleanup?: TraditionalCleanupStrategy;
  cleanupSql?: string[];
  schemaName?: string;
}

export type ZtdSqlLogOptions = {
  enabled?: boolean;
  includeParams?: boolean;
  logger?: (event: ZtdSqlLogEvent) => void;
  profile?: ZtdProfileOptions;
  mode?: ZtdExecutionMode;
  traditional?: TraditionalExecutionConfig;
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

export type ZtdProfileOptions = {
  enabled?: boolean;
  perQuery?: boolean;
  includeParams?: boolean;
  includeSql?: boolean;
  sampleLimit?: number;
  testName?: string;
  executionMode?: 'serial' | 'parallel' | 'unknown';
  logger?: (event: ZtdProfileEvent) => void;
};

const { INT2, INT4, INT8, NUMERIC, DATE } = types.builtins;
const parseInteger = (value: string | null) => (value === null ? null : Number(value));
const parseNumeric = (value: string | null) => (value === null ? null : Number(value));

// Align pg parsers with the primitive shapes the fixtures assert in tests.
types.setTypeParser(INT2, parseInteger);
types.setTypeParser(INT4, parseInteger);
types.setTypeParser(INT8, parseInteger);
types.setTypeParser(NUMERIC, parseNumeric);
types.setTypeParser(DATE, (value) => value);

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
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
    // Avoid JSON.stringify throwing on BigInt params when logging is enabled.
    if (typeof item === 'bigint') {
      return item.toString();
    }

    // Avoid JSON.stringify throwing on circular references when logging is enabled.
    if (typeof item === 'object' && item !== null) {
      if (seen.has(item)) {
        return '[Circular]';
      }
      seen.add(item);
    }
    return item;
  });
}

async function resolveDatabaseUrl(): Promise<string> {
  const configuredUrl = process.env.DATABASE_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  throw new Error('DATABASE_URL is required. It should be provided by Vitest globalSetup or your environment.');
}

async function getPgClient(): Promise<Client> {
  if (sharedPgClient) {
    return sharedPgClient;
  }

  const databaseUrl = await resolveDatabaseUrl();

  const clientConfig: ClientConfig = { connectionString: databaseUrl };
  sharedPgClient = new Client(clientConfig);

  // Keep the shared Client connected for the duration of the test run.
  await sharedPgClient.connect();
  sharedPgClient.once('end', () => {
    sharedPgClient = undefined;
    sharedQueryable = undefined;
  });
  process.once('exit', () => {
    if (!sharedPgClient) {
      return;
    }

    // Ensure node exits cleanly by closing the connection if tests end early.
    void sharedPgClient.end();
  });

  return sharedPgClient;
}

async function getPgQueryable(): Promise<PgQueryable> {
  if (sharedQueryable) {
    return sharedQueryable;
  }

  const client = await getPgClient();

  // Wrap the pg.Client to expose only the subset needed by pg-testkit.
  const wrappedQueryable: PgQueryable = {
    query: <T extends QueryResultRow>(textOrConfig: PgQueryInput, values?: unknown[]) =>
      client.query<T>(textOrConfig as never, values),
    release: () => {
      // Release is intentionally a no-op because the shared client should stay open.
      return;
    }
  };

  sharedQueryable = wrappedQueryable;
  return wrappedQueryable;
}

export type ZtdPlaygroundQueryResult<T extends QueryResultRow = QueryResultRow> = Promise<T[]>;

export type ZtdPlaygroundClient = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): ZtdPlaygroundQueryResult<T>;
  close(): Promise<void>;
};

export async function createTestkitClient(
  fixtures: TableFixture[],
  options: ZtdSqlLogOptions = {}
): Promise<ZtdPlaygroundClient> {
  const mode = resolveExecutionMode(options.mode);
  if (mode === 'traditional') {
    return createTraditionalPlaygroundClient(fixtures, options);
  }

  return createZtdPlaygroundClient(fixtures, options);
}

async function createZtdPlaygroundClient(
  fixtures: TableFixture[],
  options: ZtdSqlLogOptions
): Promise<ZtdPlaygroundClient> {
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
  } = buildLoggingState(options);

  let nextQueryId = 1;
  const queryIdStack: number[] = [];
  // Keep fixture info aligned with the active query so profiling includes applied fixtures.
  const queryFixtureMap = new Map<number, string[] | undefined>();
  // Track aggregate timings so teardown logs can summarize the run.
  const profileStats = {
    queryCount: 0,
    totalQueryMs: 0,
    sampleSql: [] as string[],
  };

  // Capture a consistent timestamp baseline for the setup phase.
  const setupStartedAt = profileEnabled ? Date.now() : 0;

  const hadSharedConnection = Boolean(sharedPgClient);
  const connectionStartedAt = profileEnabled ? Date.now() : 0;
  const queryable = await getPgQueryable();
  if (profileEnabled) {
    profileSink({
      kind: 'ztd-profile',
      phase: 'connection',
      testName: profileTestName,
      workerId: profileWorkerId,
      processId: process.pid,
      executionMode: profileExecutionMode,
      connectionReused: hadSharedConnection,
      durationMs: Date.now() - connectionStartedAt,
      timestamp: new Date().toISOString(),
    });
  }

  // TableNameResolver keeps DDL and fixtures aligned on canonical schema-qualified identifiers like 'public.table_name'.
  const driver = createPgTestkitClient({
    connectionFactory: () => queryable,
    tableRows: fixtures,
    ddl: { directories: ddlDirectories },
    onExecute: (rewrittenSql: string, params: unknown[] | undefined, fixturesApplied: string[]) => {
      if (profileEnabled) {
        // Capture fixture metadata while the original query is still on the stack.
        const activeQueryId = queryIdStack.at(-1);
        if (typeof activeQueryId === 'number') {
          queryFixtureMap.set(activeQueryId, fixturesApplied);
        }
      }

      if (!logEnabled) {
        return;
      }

      // Use a stack so concurrent async queries can still correlate "original" and "rewritten" logs.
      const queryId = queryIdStack.at(-1) ?? -1;
      logSink({
        kind: 'ztd-sql',
        phase: 'rewritten',
        queryId,
        sql: rewrittenSql,
        params: logParams ? (params as unknown[] | undefined) : undefined,
        fixturesApplied,
        timestamp: new Date().toISOString(),
      });
    },
  });

  if (profileEnabled) {
    profileSink({
      kind: 'ztd-profile',
      phase: 'setup',
      testName: profileTestName,
      workerId: profileWorkerId,
      processId: process.pid,
      executionMode: profileExecutionMode,
      durationMs: Date.now() - setupStartedAt,
      timestamp: new Date().toISOString(),
    });
  }

  // Expose a simplified query API so tests can assert on plain row arrays.
  return {
    async query<T extends QueryResultRow>(text: string, values?: unknown[]) {
      const queryId = nextQueryId++;

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
      queryIdStack.push(queryId);
      try {
        const result = await driver.query<T>(text, values);
        return result.rows;
      } finally {
        queryIdStack.pop();

        if (profileEnabled) {
          // Record per-query timing and keep a small SQL sample for teardown summaries.
          const durationMs = Date.now() - queryStartedAt;
          profileStats.queryCount += 1;
          profileStats.totalQueryMs += durationMs;

          if (profileIncludeSql && profileSampleLimit > 0 && profileStats.sampleSql.length < profileSampleLimit) {
            profileStats.sampleSql.push(text);
          }

          const fixturesApplied = queryFixtureMap.get(queryId);
          queryFixtureMap.delete(queryId);

          if (profilePerQuery) {
            profileSink({
              kind: 'ztd-profile',
              phase: 'query',
              testName: profileTestName,
              workerId: profileWorkerId,
              processId: process.pid,
              executionMode: profileExecutionMode,
              queryId,
              durationMs,
              sql: profileIncludeSql ? text : undefined,
              params: profileParams ? values : undefined,
              fixturesApplied,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    },
    async close() {
      const teardownStartedAt = profileEnabled ? Date.now() : 0;
      try {
        await driver.close();
      } finally {
        if (profileEnabled) {
          // Always emit the teardown summary, even if close fails mid-flight.
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
      }
    }
  };
}


async function createTraditionalPlaygroundClient(
  fixtures: TableFixture[],
  options: ZtdSqlLogOptions
): Promise<ZtdPlaygroundClient> {
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
  } = buildLoggingState(options);

  const databaseUrl = await resolveDatabaseUrl();
  const clientConfig: ClientConfig = { connectionString: databaseUrl };
  const client = new Client(clientConfig);
  await client.connect();

  const traditional = options.traditional;
  const isolation = traditional?.isolation ?? 'schema';
  const schemaName = isolation === 'schema' ? traditional?.schemaName ?? generateSchemaName() : undefined;
  const setupSql = traditional?.setupSql ?? [];
  const cleanupSql = traditional?.cleanupSql ?? [];
  const cleanupStrategy: TraditionalCleanupStrategy =
    traditional?.cleanup ?? (schemaName ? 'drop_schema' : 'none');

  let initializationPromise: Promise<void> | null = null;
  const setupStartedAt = profileEnabled ? Date.now() : 0;
  let setupLogged = false;

  const ensureInitialized = (): Promise<void> => {
    if (!initializationPromise) {
      initializationPromise = (async () => {
        if (schemaName) {
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schemaName)}`);
          await client.query(`SET search_path TO ${quoteIdentifier(schemaName)}, public`);
        }

        // Build the schema objects before seeding or running custom setup SQL.
        await applySqlFiles(client, ddlDirectories);

        // Allow callers to run additional setup steps before the fixtures load.
        for (const sql of setupSql) {
          if (!sql.trim()) {
            continue;
          }
          await client.query(sql);
        }

        // Materialize the fixture rows into the isolated schema.
        await seedFixtureRows(client, fixtures, schemaName);
      })().then(() => {
        if (profileEnabled && !setupLogged) {
          profileSink({
            kind: 'ztd-profile',
            phase: 'setup',
            testName: profileTestName,
            workerId: profileWorkerId,
            processId: process.pid,
            executionMode: profileExecutionMode,
            durationMs: Date.now() - setupStartedAt,
            timestamp: new Date().toISOString(),
          });
          setupLogged = true;
        }
      });
    }
    return initializationPromise;
  };

  let cleanupRun = false;
  const runCleanup = async () => {
    if (cleanupRun) {
      return;
    }
    cleanupRun = true;

    // Execute any caller-supplied cleanup statements before further teardown.
    if (cleanupStrategy === 'custom_sql') {
      for (const sql of cleanupSql) {
        if (!sql.trim()) {
          continue;
        }
        await client.query(sql);
      }
    }

    // Tear down the isolated schema when requested.
    if (cleanupStrategy === 'drop_schema' && schemaName) {
      await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`);
    }
  };

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

  let nextQueryId = 1;
  const queryIdStack: number[] = [];
  const profileStats = {
    queryCount: 0,
    totalQueryMs: 0,
    sampleSql: [] as string[],
  };

  return {
    async query<T extends QueryResultRow>(text: string, values?: unknown[]) {
      const queryId = nextQueryId++;

      // Emit the original SQL so the tracing/logging pipeline stays consistent.
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
      queryIdStack.push(queryId);
      try {
        await ensureInitialized();
        const result = await client.query<T>(text, values);
        return result.rows;
      } finally {
        queryIdStack.pop();

        if (profileEnabled) {
          const durationMs = Date.now() - queryStartedAt;
          profileStats.queryCount += 1;
          profileStats.totalQueryMs += durationMs;

          if (profileIncludeSql && profileSampleLimit > 0 && profileStats.sampleSql.length < profileSampleLimit) {
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
              durationMs,
              sql: profileIncludeSql ? text : undefined,
              params: profileParams ? values : undefined,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    },
    async close() {
      const teardownStartedAt = profileEnabled ? Date.now() : 0;
      try {
        if (initializationPromise) {
          await initializationPromise.catch(() => undefined);
        }
        await runCleanup();
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

        await client.end();
      }
    },
  };
}

function buildLoggingState(options: ZtdSqlLogOptions) {
  const logEnabled = options.enabled ?? isTruthyEnv(process.env.ZTD_SQL_LOG);
  const logParams = options.includeParams ?? isTruthyEnv(process.env.ZTD_SQL_LOG_PARAMS);
  const logSink =
    options.logger ??
    ((event: ZtdSqlLogEvent) => {
      console.log(safeJsonStringify(event));
    });

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

function generateSchemaName(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return `ztd_traditional_${timestamp}_${random}`;
}

async function applySqlFiles(client: Client, directories: string[]): Promise<void> {
  // Execute each .sql file so the physical schema matches the ZTD definitions.
  for (const directory of directories) {
    if (!existsSync(directory)) {
      continue;
    }

    const entries = await fsPromises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.sql')) {
        continue;
      }

      const filePath = path.join(directory, entry.name);
      const sql = await fsPromises.readFile(filePath, 'utf8');
      if (!sql.trim()) {
        continue;
      }

      await client.query(sql);
    }
  }
}

async function seedFixtureRows(client: Client, fixtures: TableFixture[], isolationSchema?: string): Promise<void> {
  for (const fixture of fixtures) {
    if (fixture.rows.length === 0) {
      continue;
    }

    const columnNames = getColumnNamesFromFixture(fixture);
    if (columnNames.length === 0) {
      continue;
    }

    const tableIdentifier = buildTableIdentifier(fixture.tableName, isolationSchema);
    const columnsSql = columnNames.map(quoteIdentifier).join(', ');

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
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}
