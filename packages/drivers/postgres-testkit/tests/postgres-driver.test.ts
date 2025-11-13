import type { FieldDef, QueryConfig, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import type { PostgresConnectionLike, PostgresQueryCallback } from '../src/types';
import { createPostgresSelectTestDriver, wrapPostgresDriver } from '../src';

const userFixture = {
  tableName: 'users',
  rows: [{ id: 1, email: 'alice@example.com' }],
  schema: { columns: { id: 'INTEGER', email: 'TEXT' } },
} satisfies TableFixture;

const ordersFixture = {
  tableName: 'orders',
  rows: [{ id: 2, status: 'pending' }],
  schema: { columns: { id: 'INTEGER', status: 'TEXT' } },
} satisfies TableFixture;

type RecordedQuery = {
  sql: string;
  params?: unknown[];
};

const createRecordingConnection = () => {
  const queries: RecordedQuery[] = [];
  let endCalls = 0;

  const query = async (
    textOrConfig: string | QueryConfig,
    valuesOrCallback?: unknown[] | PostgresQueryCallback,
    callback?: PostgresQueryCallback
  ): Promise<QueryResult<unknown>> => {
    const sql = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
    const params = typeof textOrConfig === 'string'
      ? (Array.isArray(valuesOrCallback) ? valuesOrCallback : undefined)
      : textOrConfig.values ?? (Array.isArray(valuesOrCallback) ? valuesOrCallback : undefined);

    // Capture every SQL execution so assertions can inspect the rewritten string.
    queries.push({ sql, params });

    const lower = sql.toLowerCase();
    // Map the SQL to the fixture rows by checking for the target table name in the rewritten statement.
    const rows = lower.includes('orders')
      ? ordersFixture.rows
      : lower.includes('users')
        ? userFixture.rows
        : [];

    const result: QueryResult<unknown> = {
      command: 'SELECT',
      rowCount: rows.length,
      oid: 0,
      rows,
      fields: [] as FieldDef[],
    };
    return result;
  };

  const driver: PostgresConnectionLike = {
    query,
    end: async () => {
      endCalls += 1;
    },
  };

  return {
    driver,
    queries,
    get endCount() {
      return endCalls;
    },
  };
};

describe('postgres select test driver', () => {
  it('rewrites SELECT statements before execution', async () => {
    const recording = createRecordingConnection();
    let factoryCalls = 0;

    const driver = createPostgresSelectTestDriver({
      connectionFactory: () => {
        factoryCalls += 1;
        return recording.driver;
      },
      fixtures: [userFixture],
    });

    // Trigger the rewrite and capture the driver output.
    const rows = await driver.query('SELECT id, email FROM users');

    expect(rows).toEqual(userFixture.rows);
    expect(recording.queries[0]?.sql).toMatch(/^with/i);
    expect(factoryCalls).toBe(1);

    await driver.close();
    expect(recording.endCount).toBe(1);
  });

  it('reuses the same connection when deriving scoped fixtures', async () => {
    const recording = createRecordingConnection();
    const driver = createPostgresSelectTestDriver({
      connectionFactory: () => recording.driver,
      fixtures: [userFixture],
    });

    await driver.query('SELECT * FROM users');
    const scoped = driver.withFixtures([ordersFixture]);

    // Ensure the scoped driver still hits the same connection.
    await scoped.query('SELECT * FROM orders');

    expect(recording.queries).toHaveLength(2);
    expect(recording.queries[1]?.sql).toMatch(/orders/i);

    await driver.close();
    expect(recording.endCount).toBe(1);
  });
});

describe('wrapPostgresDriver', () => {
  it('rewrites SELECT queries and logs them when requested', async () => {
    const recording = createRecordingConnection();

    const wrapped = wrapPostgresDriver(recording.driver, {
      fixtures: [userFixture],
      recordQueries: true,
    });

    // Execute through the wrapper to produce rewrite logs.
    await wrapped.query('SELECT * FROM users');

    expect(recording.queries[0]?.sql).toMatch(/^with/i);
    expect(wrapped.queries).toHaveLength(1);
    expect(wrapped.queries?.[0].sql).toMatch(/^with/i);
  });

  it('derives new proxies without mutating the base wrapper', async () => {
    const recording = createRecordingConnection();

    const wrapped = wrapPostgresDriver(recording.driver, {
      fixtures: [userFixture],
      recordQueries: true,
    });

    const scoped = wrapped.withFixtures([ordersFixture]);

    // Drive both proxies so each builds its own query log.
    await scoped.query('SELECT * FROM orders');
    await wrapped.query('SELECT * FROM users');

    expect(scoped).not.toBe(wrapped);
    expect(scoped.queries).toHaveLength(1);
    expect(wrapped.queries).toHaveLength(1);
    expect(scoped.queries?.[0].sql).toContain('orders');
    expect(wrapped.queries?.[0].sql).toContain('users');
  });

  it('invokes the onExecute hook with rewritten SQL and params', async () => {
    const recording = createRecordingConnection();
    const onExecute = vi.fn();

    const wrapped = wrapPostgresDriver(recording.driver, {
      fixtures: [userFixture],
      onExecute,
    });

    // Execute a parameterized query so the hook receives both SQL and params.
    await wrapped.query('SELECT * FROM users WHERE id = $1', [1]);

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute.mock.calls[0][0]).toMatch(/^with/i);
    expect(onExecute.mock.calls[0][1]).toEqual([1]);
  });

  it('passes non-SELECT statements through without rewriting', async () => {
    const recording = createRecordingConnection();

    const wrapped = wrapPostgresDriver(recording.driver, {
      fixtures: [],
    });

    const rawSql = "INSERT INTO customers (id) VALUES (1)";
    // Run a DML statement to verify it bypasses the rewriter.
    await wrapped.query(rawSql);

    expect(recording.queries.at(-1)?.sql).toBe(rawSql);
  });
});
