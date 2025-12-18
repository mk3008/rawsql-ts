// ZTD testkit helper - AUTO GENERATED
// ztd-cli emits this file during project bootstrapping to wire pg-testkit.
// Regenerate via npx ztd init (choose overwrite when prompted); avoid manual edits.

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

export type ZtdSqlLogOptions = {
  enabled?: boolean;
  includeParams?: boolean;
  logger?: (event: ZtdSqlLogEvent) => void;
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

function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    // Avoid JSON.stringify throwing on BigInt params when logging is enabled.
    if (typeof item === 'bigint') {
      return item.toString();
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
  const logEnabled = options.enabled ?? isTruthyEnv(process.env.ZTD_SQL_LOG);
  const logParams = options.includeParams ?? isTruthyEnv(process.env.ZTD_SQL_LOG_PARAMS);
  const logSink =
    options.logger ??
    ((event: ZtdSqlLogEvent) => {
      console.log(safeJsonStringify(event));
    });

  let nextQueryId = 1;
  const queryIdStack: number[] = [];

  const queryable = await getPgQueryable();
  // TableNameResolver keeps DDL and fixtures aligned on canonical schema-qualified identifiers like 'public.table_name'.
  const driver = createPgTestkitClient({
    connectionFactory: () => queryable,
    tableRows: fixtures,
    ddl: { directories: ddlDirectories },
    onExecute: (rewrittenSql, params, fixturesApplied) => {
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

      queryIdStack.push(queryId);
      try {
        const result = await driver.query<T>(text, values);
        return result.rows;
      } finally {
        queryIdStack.pop();
      }
    },
    close() {
      return driver.close();
    }
  };
}
