import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { createSqliteSelectTestDriver } from '../src/driver/SqliteSelectTestDriver';
import { wrapSqliteDriver } from '../src/proxy/wrapSqliteDriver';
import type { SqliteConnectionLike, SqliteStatementLike } from '../src/types';

const userFixture = {
  tableName: 'users',
  rows: [{ id: 1, email: 'alice@example.com' }],
  schema: { columns: { id: 'INTEGER', email: 'TEXT' } },
};

type RecordedStatement = {
  sql: string;
  stage: 'prepare' | 'direct' | 'statement';
};

const wrapStatement = (
  statement: SqliteStatementLike,
  sql: string,
  statements: RecordedStatement[]
): SqliteStatementLike => {
  return new Proxy(statement, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') {
        return value;
      }

      if (prop === 'all' || prop === 'get' || prop === 'run') {
        return (...args: unknown[]) => {
          // Record the rewritten SQL whenever the statement executes.
          statements.push({ sql, stage: 'statement' });
          return value.apply(target, args);
        };
      }

      return value.bind(target);
    },
  });
};

type RecordingConnection = {
  driver: SqliteConnectionLike;
  statements: RecordedStatement[];
  close: () => void;
};

const createRecordingConnection = (): RecordingConnection => {
  const db = new Database(':memory:');
  const statements: RecordedStatement[] = [];
  let closed = false;

  const close = () => {
    if (!closed) {
      // Ensure we dispose the native handle exactly once.
      closed = true;
      db.close();
    }
  };

  const proxy = new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'close') {
        return close;
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') {
        return value;
      }

      if (prop === 'prepare') {
        return (sql: string, ...args: unknown[]) => {
          // Track the SQL entering the driver before execution.
          statements.push({ sql, stage: 'prepare' });
          const statement = value.apply(target, [sql, ...args]) as SqliteStatementLike;
          return wrapStatement(statement, sql, statements);
        };
      }

      if (prop === 'exec' || prop === 'all' || prop === 'get' || prop === 'run') {
        return (sql: string, ...args: unknown[]) => {
          // Capture high-level helpers that bypass prepare().
          statements.push({ sql, stage: 'direct' });
          return value.apply(target, [sql, ...args]);
        };
      }

      return value.bind(target);
    },
  });

  return { driver: proxy as SqliteConnectionLike, statements, close };
};

describe('sqlite select test driver', () => {
  it('rewrites SQL before hitting the underlying driver', async () => {
    const recording = createRecordingConnection();
    const driver = createSqliteSelectTestDriver({
      connectionFactory: () => recording.driver,
      fixtures: [userFixture],
    });

    const rows = await driver.query('SELECT * FROM users');

    expect(rows).toEqual([{ id: 1, email: 'alice@example.com' }]);
    expect(recording.statements[0]?.sql).toMatch(/^with/i);

    driver.close();
  });

  it('shares the same connection when deriving scoped fixtures', async () => {
    const recording = createRecordingConnection();
    const driver = createSqliteSelectTestDriver({
      connectionFactory: () => recording.driver,
      fixtures: [userFixture],
    });

    await driver.query('SELECT * FROM users');

    const scoped = driver.withFixtures([
      { tableName: 'orders', rows: [{ id: 2 }], schema: { columns: { id: 'INTEGER' } } },
    ]);

    await scoped.query('SELECT * FROM orders');
    const prepareStatements = recording.statements.filter((entry) => entry.stage === 'prepare');
    expect(prepareStatements).toHaveLength(2);

    driver.close();
  });
});

describe('wrapSqliteDriver', () => {
  it('intercepts exec/get/all helpers', () => {
    const sqlite = new Database(':memory:');
    const wrapped = wrapSqliteDriver(sqlite as unknown as SqliteConnectionLike, {
      fixtures: [userFixture],
      recordQueries: true,
    });

    wrapped.exec?.('SELECT * FROM users');
    const statement = wrapped.prepare?.('SELECT * FROM users');
    const rows = statement?.all?.();
    const single = statement?.get?.();

    expect(rows).toEqual([{ id: 1, email: 'alice@example.com' }]);
    expect(single).toEqual({ id: 1, email: 'alice@example.com' });
    expect(wrapped.queries?.every((entry) => /^with/i.test(entry.sql))).toBe(true);

    sqlite.close();
  });

  it('allows per-proxy fixture overrides', () => {
    const sqlite = new Database(':memory:');
    const wrapped = wrapSqliteDriver(sqlite as unknown as SqliteConnectionLike, {
      fixtures: [],
    });

    const scoped = wrapped.withFixtures([
      {
        tableName: 'users',
        rows: [{ id: 1, email: 'alice@example.com' }],
        schema: { columns: { id: 'INTEGER', email: 'TEXT' } },
      },
    ]);

    const rows = scoped.prepare?.('SELECT * FROM users')?.all?.();
    expect(rows).toEqual([{ id: 1, email: 'alice@example.com' }]);

    sqlite.close();
  });

  it('derives scoped proxies without mutating the original wrapper', () => {
    const sqlite = new Database(':memory:');
    const wrapped = wrapSqliteDriver(sqlite as unknown as SqliteConnectionLike, {
      fixtures: [userFixture],
      recordQueries: true,
    });

    const scoped = wrapped.withFixtures([
      { tableName: 'orders', rows: [{ id: 2 }], schema: { columns: { id: 'INTEGER' } } },
    ]);

    const scopedRows = scoped.prepare?.('SELECT * FROM orders')?.all?.();
    const baseRows = wrapped.prepare?.('SELECT * FROM users')?.all?.();

    expect(scoped).not.toBe(wrapped);
    expect(scopedRows).toEqual([{ id: 2 }]);
    expect(baseRows).toEqual([{ id: 1, email: 'alice@example.com' }]);
    expect(scoped.queries?.[0].sql).toContain('orders');
    expect(wrapped.queries?.[1]?.sql ?? wrapped.queries?.[0].sql).toContain('users');

    sqlite.close();
  });

  it('invokes the onExecute hook with rewritten SQL and provided params', () => {
    const sqlite = new Database(':memory:');
    const onExecute = vi.fn();

    const wrapped = wrapSqliteDriver(sqlite as unknown as SqliteConnectionLike, {
      fixtures: [userFixture],
      onExecute,
    });

    wrapped.exec?.('SELECT * FROM users');
    const statement = wrapped.prepare?.('SELECT * FROM users WHERE email = @email LIMIT @limit');
    const params = { email: 'alice@example.com', limit: 1 };
    const record = statement?.get(params);

    expect(record).toEqual({ id: 1, email: 'alice@example.com' });
    expect(onExecute).toHaveBeenCalledTimes(2);
    expect(onExecute.mock.calls[0][0]).toMatch(/^with/i);
    expect(onExecute.mock.calls[1][1]).toEqual(params);

    sqlite.close();
  });

  it('records executed queries per proxy when enabled', () => {
    const sqlite = new Database(':memory:');
    const wrapped = wrapSqliteDriver(sqlite as unknown as SqliteConnectionLike, {
      fixtures: [userFixture],
      recordQueries: true,
    });

    wrapped.exec?.('SELECT * FROM users');
    expect(wrapped.queries).toHaveLength(1);
    expect(wrapped.queries?.[0].sql).toMatch(/^with/i);

    const scoped = wrapped.withFixtures([
      { tableName: 'orders', rows: [{ id: 2 }], schema: { columns: { id: 'INTEGER' } } },
    ]);
    scoped.exec?.('SELECT * FROM orders');

    expect(scoped.queries).toHaveLength(1);
    expect(scoped.queries?.[0].sql).toContain('orders');
    expect(wrapped.queries).toHaveLength(1);

    sqlite.close();
  });

  it('passes non-select statements through without rewriting', () => {
    const recording = createRecordingConnection();
    recording.driver.exec?.('CREATE TABLE customers (id INTEGER PRIMARY KEY, tier TEXT)');
    recording.driver.exec?.("INSERT INTO customers (tier) VALUES ('basic')");

    const wrapped = wrapSqliteDriver(recording.driver, {
      fixtures: [],
    });

    const updateSql = "UPDATE customers SET tier = 'vip' WHERE rowid = 1";
    wrapped.exec?.(updateSql);

    expect(recording.statements.at(-1)?.sql).toBe(updateSql);

    recording.close();
  });
});
