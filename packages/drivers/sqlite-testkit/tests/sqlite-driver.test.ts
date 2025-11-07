import { describe, expect, it, vi } from 'vitest';
import { createSqliteSelectTestDriver } from '../src/driver/SqliteSelectTestDriver';
import { wrapSqliteDriver } from '../src/proxy/wrapSqliteDriver';
import type { SqliteConnectionLike } from '../src/types';

class FakeStatement {
  constructor(private readonly rows: unknown[]) {}
  public all(..._params: unknown[]) {
    return this.rows;
  }
}

class FakeConnection implements SqliteConnectionLike {
  public statements: string[] = [];
  constructor(private readonly rows: unknown[]) {}
  prepare(sql: string) {
    this.statements.push(sql);
    return new FakeStatement(this.rows);
  }
}

describe('sqlite select test driver', () => {
  it('rewrites SQL before hitting the underlying driver', async () => {
    const connection = new FakeConnection([{ id: 1 }]);
    const driver = createSqliteSelectTestDriver({
      connectionFactory: () => connection,
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1 }],
          schema: { columns: { id: 'INTEGER' } },
        },
      ],
    });

    const rows = await driver.query('SELECT * FROM users');

    expect(rows).toEqual([{ id: 1 }]);
    expect(connection.statements[0]).toMatch(/^WITH/);
  });

  it('shares the same connection when deriving scoped fixtures', async () => {
    const connection = new FakeConnection([{ id: 1 }]);
    const driver = createSqliteSelectTestDriver({
      connectionFactory: () => connection,
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1 }],
          schema: { columns: { id: 'INTEGER' } },
        },
      ],
    });

    await driver.query('SELECT * FROM users');

    const scoped = driver.withFixtures([
      { tableName: 'orders', rows: [{ id: 2 }], schema: { columns: { id: 'INTEGER' } } },
    ]);

    await scoped.query('SELECT * FROM orders');
    expect(connection.statements.length).toBe(2);
  });
});

describe('wrapSqliteDriver', () => {
  it('intercepts exec/get/all helpers', () => {
    const exec = vi.fn();
    const all = vi.fn();
    const driver = {
      exec,
      all,
    } as unknown as SqliteConnectionLike;

    const wrapped = wrapSqliteDriver(driver, {
      fixtures: [
        { tableName: 'users', rows: [{ id: 1 }], schema: { columns: { id: 'INTEGER' } } },
      ],
    });

    wrapped.exec?.('SELECT * FROM users');
    expect(exec).toHaveBeenCalled();

    wrapped.all?.('SELECT * FROM users');
    expect(all.mock.calls[0][0]).toMatch(/^WITH/);
  });

  it('allows per-proxy fixture overrides', () => {
    const exec = vi.fn();
    const driver = { exec } as unknown as SqliteConnectionLike;

    const wrapped = wrapSqliteDriver(driver, {
      fixtures: [],
    });

    wrapped.withFixtures([
      { tableName: 'users', rows: [{ id: 1 }], schema: { columns: { id: 'INTEGER' } } },
    ]).exec?.('SELECT * FROM users');

    expect(exec.mock.calls[0][0]).toMatch(/^WITH/);
  });

  it('derives scoped proxies without mutating the original wrapper', () => {
    const statements: string[] = [];
    const driver: SqliteConnectionLike = {
      exec(sql: string) {
        statements.push(sql);
      },
    };

    // Seed the base proxy with a users fixture so follow-up calls still resolve.
    const wrapped = wrapSqliteDriver(driver, {
      fixtures: [{ tableName: 'users', rows: [{ id: 1 }], schema: { columns: { id: 'INTEGER' } } }],
    });

    const scoped = wrapped.withFixtures([
      { tableName: 'orders', rows: [{ id: 2 }], schema: { columns: { id: 'INTEGER' } } },
    ]);

    // Verify the scoped proxy emits SQL for its own fixtures while leaving the base proxy untouched.
    scoped.exec?.('SELECT * FROM orders');
    wrapped.exec?.('SELECT * FROM users');

    expect(scoped).not.toBe(wrapped);
    expect(statements[0]).toContain('orders');
    expect(statements[1]).toContain('users');
  });

  it('invokes the onExecute hook with rewritten SQL and provided params', () => {
    const exec = vi.fn();
    const statement = {
      get: vi.fn(),
    };
    const driver: SqliteConnectionLike = {
      exec,
      prepare: vi.fn(() => statement),
    };

    const onExecute = vi.fn();

    const wrapped = wrapSqliteDriver(driver, {
      fixtures: [{ tableName: 'users', rows: [{ id: 1 }], schema: { columns: { id: 'INTEGER' } } }],
      onExecute,
    });

    wrapped.exec?.('SELECT * FROM users');
    const prepared = wrapped.prepare?.(
      'SELECT * FROM users WHERE email = @email LIMIT @limit'
    );
    prepared?.get({ email: 'carol@example.com', limit: 1 });

    expect(onExecute).toHaveBeenCalledTimes(2);
    expect(onExecute.mock.calls[0][0]).toMatch(/^WITH/);
    expect(onExecute.mock.calls[1][1]).toEqual({ email: 'carol@example.com', limit: 1 });
  });

  it('records executed queries per proxy when enabled', () => {
    const exec = vi.fn();
    const driver = { exec } as unknown as SqliteConnectionLike;

    const wrapped = wrapSqliteDriver(driver, {
      fixtures: [{ tableName: 'users', rows: [{ id: 1 }], schema: { columns: { id: 'INTEGER' } } }],
      recordQueries: true,
    });

    wrapped.exec?.('SELECT * FROM users');
    expect(wrapped.queries).toHaveLength(1);
    expect(wrapped.queries?.[0].sql).toMatch(/^WITH/);

    const scoped = wrapped.withFixtures([
      { tableName: 'orders', rows: [{ id: 2 }], schema: { columns: { id: 'INTEGER' } } },
    ]);
    scoped.exec?.('SELECT * FROM orders');

    expect(scoped.queries).toHaveLength(1);
    expect(scoped.queries?.[0].sql).toContain('orders');
    expect(wrapped.queries).toHaveLength(1);
  });
});
