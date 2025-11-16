import type { FieldDef, QueryConfig, QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { CudValidationError } from '@rawsql-ts/testkit-core';
import type { TableDef, TableFixture } from '@rawsql-ts/testkit-core';
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

const userTableDef: TableDef = {
  tableName: 'users',
  columns: [
    { name: 'id', dbType: 'INTEGER', nullable: false },
    { name: 'email', dbType: 'TEXT', nullable: false },
  ],
};

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
  ): Promise<QueryResult<QueryResultRow>> => {
    const sql = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
    const params = typeof textOrConfig === 'string'
      ? (Array.isArray(valuesOrCallback) ? valuesOrCallback : undefined)
      : textOrConfig.values ?? (Array.isArray(valuesOrCallback) ? valuesOrCallback : undefined);

    // Capture every SQL execution so assertions can inspect the rewritten string.
    queries.push({ sql, params });

    const lower = sql.toLowerCase();
    // Map the SQL to the fixture rows by checking for the target table name in the rewritten statement.
    const rows: QueryResultRow[] = lower.includes('orders')
      ? ordersFixture.rows
      : lower.includes('users')
        ? userFixture.rows
        : [];

    const result: QueryResult<QueryResultRow> = {
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

describe('wrapPostgresDriver CUD pipeline', () => {
  const insertSql = "INSERT INTO users (id, email) VALUES (5, 'dave@example.com')";
  const dtoSql = "INSERT INTO users (id, email) SELECT 1 AS id, 'dto@example.com' AS email";

  it('rewrites INSERT statements when TableDef metadata is provided', async () => {
    const recording = createRecordingConnection();
    const wrapped = wrapPostgresDriver(recording.driver, {
      fixtures: [],
      tableDefs: [userTableDef],
    });

    await wrapped.query(insertSql, [4, 'dave@example.com']);

    const executed = recording.queries.at(-1)?.sql ?? '';
    const normalized = executed.toLowerCase();
    expect(normalized).toContain('insert into "users"');
    expect(normalized).toContain('select');
    expect(normalized).toContain('from (values');
  });

  it('surfaces CudValidationError when strict shape validation runs', () => {
    const recording = createRecordingConnection();
    const wrapped = wrapPostgresDriver(recording.driver, {
      fixtures: [],
      tableDefs: [userTableDef],
    });

    expect(() => wrapped.query("INSERT INTO users (email) VALUES ('missing')")).toThrow(
      CudValidationError
    );
  });

  it('falls back to the original SQL when failOnShapeIssues is disabled', async () => {
    const recording = createRecordingConnection();
    const wrapped = wrapPostgresDriver(recording.driver, {
      fixtures: [],
      tableDefs: [userTableDef],
      cudOptions: { failOnShapeIssues: false },
    });

    await wrapped.query("INSERT INTO users (email) VALUES ('fallback')");

    expect(recording.queries.at(-1)?.sql).toBe("INSERT INTO users (email) VALUES ('fallback')");
  });

  it('allows DTO inserts without FROM when runtime validation is disabled', async () => {
    const recording = createRecordingConnection();
    const wrapped = wrapPostgresDriver(recording.driver, {
      fixtures: [],
      tableDefs: [userTableDef],
      cudOptions: { enableRuntimeDtoValidation: false },
    });

    await wrapped.query(dtoSql);

    expect(recording.queries.at(-1)?.sql?.toLowerCase()).toContain('select');
  });

  it('respects the enableTypeCasts flag', async () => {
    const recordingStrict = createRecordingConnection();
    const wrappedStrict = wrapPostgresDriver(recordingStrict.driver, {
      fixtures: [],
      tableDefs: [userTableDef],
    });
    await wrappedStrict.query(insertSql);

    const castSql = (recordingStrict.queries.at(-1)?.sql ?? '').toLowerCase();
    expect(castSql).toContain('cast(');

    const recordingLoose = createRecordingConnection();
    const wrappedLoose = wrapPostgresDriver(recordingLoose.driver, {
      fixtures: [],
      tableDefs: [userTableDef],
      cudOptions: { enableTypeCasts: false },
    });
    const alternateInsert = "INSERT INTO users (id, email) VALUES (6, 'nocast@example.com')";
    await wrappedLoose.query(alternateInsert);

    const noCastSql = (recordingLoose.queries.at(-1)?.sql ?? '').toLowerCase();
    expect(noCastSql).not.toContain('cast(');
  });
});

describe('postgres DML passthrough', () => {
  it('lets createPostgresSelectTestDriver forward INSERT strings unmodified', async () => {
    const recording = createRecordingConnection();
    const driver = createPostgresSelectTestDriver({
      connectionFactory: () => recording.driver,
      fixtures: [userFixture],
    });

    const insertSql = "INSERT INTO users (id, email) VALUES (3, 'charlie@example.com')";
    // Exercise an INSERT through the test driver to ensure DML bypasses the rewriter.
    await driver.query(insertSql);

    expect(recording.queries.at(-1)?.sql).toBe(insertSql);
    expect(recording.queries.at(-1)?.params).toBeUndefined();

    await driver.close();
  });

  it('forwards parameterized UPDATE statements with positional params', async () => {
    const recording = createRecordingConnection();
    const driver = createPostgresSelectTestDriver({
      connectionFactory: () => recording.driver,
      fixtures: [ordersFixture],
    });

    const updateSql = 'UPDATE orders SET status = $1 WHERE id = $2';
    const params = ['complete', 2];
    // Execute an UPDATE with positional parameters so the recording driver receives the args intact.
    await driver.query(updateSql, params);

    expect(recording.queries.at(-1)?.sql).toBe(updateSql);
    expect(recording.queries.at(-1)?.params).toEqual(params);

    await driver.close();
  });

  it('lets wrapPostgresDriver pass DELETE statements through when using QueryConfig and scoped fixtures', async () => {
    const recording = createRecordingConnection();
    const wrapped = wrapPostgresDriver(recording.driver, {
      fixtures: [userFixture],
    });

    const scoped = wrapped.withFixtures([ordersFixture]);
    const deleteConfig: QueryConfig = {
      text: 'DELETE FROM orders WHERE status = $1',
      values: ['pending'],
    };
    // Run a DELETE via the scoped wrapper to confirm QueryConfig overloads still bypass the rewriter.
    await scoped.query(deleteConfig);

    expect(recording.queries.at(-1)?.sql).toBe(deleteConfig.text);
    expect(recording.queries.at(-1)?.params).toEqual(deleteConfig.values);
  });
});

const createDalRecordingConnection = () => {
  const queries: RecordedQuery[] = [];
  const driver: PostgresConnectionLike = {
    query: async (
      textOrConfig: string | QueryConfig,
      valuesOrCallback?: unknown[] | PostgresQueryCallback,
      callback?: PostgresQueryCallback
    ) => {
      const sql = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
      const params =
        typeof textOrConfig === 'string'
          ? (Array.isArray(valuesOrCallback) ? valuesOrCallback : undefined)
          : textOrConfig.values ?? (Array.isArray(valuesOrCallback) ? valuesOrCallback : undefined);

      // Record every SQL execution while pretending the connection returns no payload.
      queries.push({ sql, params });
      return {
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        rows: [],
        fields: [] as FieldDef[],
      };
    },
  };

  return { driver, queries };
};

describe('postgres DAL insert simulation', () => {
  const insertSql =
    "INSERT INTO users (email, status) VALUES ('demo@example.com', 'active') RETURNING id, email, status";

  it('runs the DTO SELECT and returns the simulated RETURNING row', async () => {
    const recording = createDalRecordingConnection();
    const wrapped = wrapPostgresDriver(recording.driver, {
      fixtures: [],
      tableDefs: [userTableDef],
      simulateCudReturning: true,
    });

    const result = await wrapped.query(insertSql);

    expect(result.rows[0]).toMatchObject({
      id: 1,
      email: 'demo@example.com',
      status: 'active',
    });

    const recorded = (recording.queries.at(-1)?.sql ?? '').trim().toLowerCase();
    expect(recorded.startsWith('select')).toBe(true);
    expect(recorded).not.toContain('insert into');
  });

  it('increments auto-number columns even when the connection returns nothing', async () => {
    const recording = createDalRecordingConnection();
    const wrapped = wrapPostgresDriver(recording.driver, {
      fixtures: [],
      tableDefs: [userTableDef],
      simulateCudReturning: true,
    });

    const first = await wrapped.query(insertSql);
    const second = await wrapped.query(insertSql);

    expect(first.rows[0].id).toBe(1);
    expect(second.rows[0].id).toBe(2);
    expect(recording.queries).toHaveLength(2);
  });
});
