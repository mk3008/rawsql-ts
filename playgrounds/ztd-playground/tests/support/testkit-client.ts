import { existsSync, promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { Client, types } from 'pg';
import type { ClientConfig, QueryResultRow } from 'pg';
import { createPgTestkitClient } from '@rawsql-ts/pg-testkit';
import type { PgQueryInput, PgQueryable } from '@rawsql-ts/pg-testkit';
import type { TableFixture } from '@rawsql-ts/testkit-core';

const ddlDirectories = [path.resolve(__dirname, '../../ztd/ddl')];

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

export interface ZtdPlaygroundClientOptions {
  mode?: ZtdExecutionMode;
  traditional?: TraditionalExecutionConfig;
}

let sharedPgClient: Client | undefined;
let sharedQueryable: PgQueryable | undefined;

const { INT2, INT4, INT8, NUMERIC, DATE } = types.builtins;
const parseInteger = (value: string | null) => (value === null ? null : Number(value));
const parseNumeric = (value: string | null) => (value === null ? null : Number(value));

// Align pg parsers with the primitive shapes the fixtures assert in tests.
types.setTypeParser(INT2, parseInteger);
types.setTypeParser(INT4, parseInteger);
types.setTypeParser(INT8, parseInteger);
types.setTypeParser(NUMERIC, parseNumeric);
types.setTypeParser(DATE, (value) => value);

async function resolveDatabaseUrl(): Promise<string> {
  const configuredUrl = process.env.DATABASE_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  throw new Error(
    'DATABASE_URL is required. It should be provided by Vitest globalSetup or your environment.',
  );
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
    },
  };

  sharedQueryable = wrappedQueryable;
  return wrappedQueryable;
}

export type ZtdPlaygroundQueryResult<T extends QueryResultRow = QueryResultRow> = Promise<T[]>;

export type ZtdPlaygroundClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): ZtdPlaygroundQueryResult<T>;
  close(): Promise<void>;
};

export async function createTestkitClient(
  fixtures: TableFixture[],
  options: ZtdPlaygroundClientOptions = {},
): Promise<ZtdPlaygroundClient> {
  const mode = resolveExecutionMode(options.mode);
  if (mode === 'traditional') {
    return createTraditionalPlaygroundClient(fixtures, options.traditional);
  }

  return createZtdPlaygroundClient(fixtures);
}

async function createZtdPlaygroundClient(fixtures: TableFixture[]): Promise<ZtdPlaygroundClient> {
  const queryable = await getPgQueryable();
  // TableNameResolver keeps DDL and fixtures aligned on canonical schema-qualified identifiers like 'public.customer'.
  const driver = createPgTestkitClient({
    connectionFactory: () => queryable,
    tableRows: fixtures,
    ddl: { directories: ddlDirectories },
  });

  // Expose a simplified query API so tests can assert on plain row arrays.
  return {
    async query<T extends QueryResultRow>(text: string, values?: unknown[]) {
      const result = await driver.query<T>(text, values);
      return result.rows;
    },
    close() {
      return driver.close();
    },
  };
}

async function createTraditionalPlaygroundClient(
  fixtures: TableFixture[],
  config: TraditionalExecutionConfig | undefined,
): Promise<ZtdPlaygroundClient> {
  const databaseUrl = await resolveDatabaseUrl();
  const clientConfig: ClientConfig = { connectionString: databaseUrl };
  const client = new Client(clientConfig);
  await client.connect();

  const isolation = config?.isolation ?? 'schema';
  const schemaName = isolation === 'schema' ? config?.schemaName ?? generateSchemaName() : undefined;
  const setupSql = config?.setupSql ?? [];
  const cleanupSql = config?.cleanupSql ?? [];
  const cleanupStrategy: TraditionalCleanupStrategy =
    config?.cleanup ?? (schemaName ? 'drop_schema' : 'none');

  let initializationPromise: Promise<void> | null = null;
  const ensureInitialized = (): Promise<void> => {
    if (!initializationPromise) {
      initializationPromise = (async () => {
        if (schemaName) {
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schemaName)}`);
          await client.query(`SET search_path TO ${quoteIdentifier(schemaName)}, public`);
        }

        // Build the schema objects before the fixtures or setup SQL run.
        await applySqlFiles(client, ddlDirectories);

        // Apply optional setup SQL that may prepare migrations or additional data.
        for (const sql of setupSql) {
          if (!sql.trim()) {
            continue;
          }
          await client.query(sql);
        }

        // Insert the fixture rows so the tests can query against real data.
        await seedFixtureRows(client, fixtures, schemaName);
      })();
    }
    return initializationPromise;
  };

  let cleanupRun = false;
  const runCleanup = async () => {
    if (cleanupRun) {
      return;
    }
    cleanupRun = true;

    // Execute any caller-provided cleanup statements before other teardown steps.
    if (cleanupStrategy === 'custom_sql') {
      for (const sql of cleanupSql) {
        if (!sql.trim()) {
          continue;
        }
        await client.query(sql);
      }
    }

    // Tear down the isolated schema when the strategy requests it.
    if (cleanupStrategy === 'drop_schema' && schemaName) {
      await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`);
    }
  };

  return {
    async query<T extends QueryResultRow>(text: string, values?: unknown[]) {
      await ensureInitialized();
      const result = await client.query<T>(text, values);
      return result.rows;
    },
    async close() {
      try {
        if (initializationPromise) {
          await initializationPromise.catch(() => undefined);
        }
        await runCleanup();
      } finally {
        await client.end();
      }
    },
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
  // Execute each .sql script so the physical schema matches the ZTD DDL definition.
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

    // Insert each row so the traditional mode observes the same data as the ZTD fixtures.
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

