import path from 'node:path';
import { Client, types } from 'pg';
import type { ClientConfig, QueryResultRow } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { createPgTestkitClient } from '@rawsql-ts/pg-testkit';
import type { PgQueryInput, PgQueryable } from '@rawsql-ts/pg-testkit';
import type { TableFixture } from '@rawsql-ts/testkit-core';

const ddlDirectories = [path.resolve(__dirname, '../ztd/ddl')];

let sharedPgClient: Client | undefined;
let sharedQueryable: PgQueryable | undefined;
const POSTGRES_IMAGE = 'postgres:16-alpine';
type StartedPostgreSqlContainer = Awaited<ReturnType<PostgreSqlContainer['start']>>;
let sharedContainer: StartedPostgreSqlContainer | undefined;

const { INT2, INT4, INT8, NUMERIC, DATE } = types.builtins;
const parseInteger = (value: string | null) => (value === null ? null : Number(value));
const parseNumeric = (value: string | null) => (value === null ? null : Number(value));

// Align pg parsers with the primitive shapes the fixtures assert in tests.
types.setTypeParser(INT2, parseInteger);
types.setTypeParser(INT4, parseInteger);
types.setTypeParser(INT8, parseInteger);
types.setTypeParser(NUMERIC, parseNumeric);
types.setTypeParser(DATE, (value) => value);

function isMissingRuntimeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Could not find a working container runtime strategy')
  );
}

async function resolveDatabaseUrl(): Promise<string> {
  const configuredUrl = process.env.DATABASE_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  if (!sharedContainer) {
    const container = new PostgreSqlContainer(POSTGRES_IMAGE)
      .withDatabase('ztd_playground')
      .withUsername('postgres')
      .withPassword('postgres');

    try {
      // Create and start a disposable Postgres instance when no DATABASE_URL is provided.
      sharedContainer = await container.start();
    } catch (error) {
      if (isMissingRuntimeError(error)) {
        throw new Error(
          'Could not start a Postgres testcontainer; ensure Docker is running and accessible, or set DATABASE_URL.',
        );
      }
      throw error;
    }

    // Stop the temporary container when the node process is shutting down.
    process.once('exit', () => {
      if (!sharedContainer) {
        return;
      }
      void sharedContainer.stop();
    });
  }

  return sharedContainer.getConnectionUri();
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

export async function createTestkitClient(fixtures: TableFixture[]): Promise<ZtdPlaygroundClient> {
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
