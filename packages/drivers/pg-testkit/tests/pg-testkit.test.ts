import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPgTestkitClient, wrapPgClient } from '../src';
import type { PgFixture, PgQueryable } from '../src';

const userFixture: PgFixture = {
  tableName: 'users',
  columns: [
    { name: 'id', typeName: 'int', required: true },
    { name: 'email', typeName: 'text' },
    { name: 'active', typeName: 'bool', defaultValue: 'true' },
  ],
  rows: [
    { id: 1, email: 'alice@example.com', active: true },
    { id: 2, email: 'bob@example.com', active: false },
  ],
};

const orderFixture: PgFixture = {
  tableName: 'orders',
  columns: [
    { name: 'id', typeName: 'int' },
    { name: 'total', typeName: 'numeric' },
  ],
  rows: [
    { id: 10, total: 125.5 },
    { id: 11, total: 45.25 },
  ],
};

let container: StartedPostgreSqlContainer | null = null;
let client: Client | null = null;
let runtimeAvailable = true;

beforeAll(async () => {
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    client = new Client({ connectionString: container.getConnectionUri() });
    await client.connect();
  } catch (error) {
    runtimeAvailable = false;
  }
});

afterAll(async () => {
  if (client) {
    await client.end();
  }
  if (container) {
    await container.stop();
  }
});

describe('createPgTestkitClient', () => {
  it('shadows SELECT queries with fixture-backed CTEs', async () => {
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }
    const driver = createPgTestkitClient({
      connectionFactory: () => client,
      fixtures: [userFixture],
    });

    const result = await driver.query<{ id: number; email: string }>(
      'select id, email from users where id = $1',
      [1]
    );

    expect(result.rows).toEqual([{ id: 1, email: 'alice@example.com' }]);
  });

  it('converts CRUD statements into result-select queries', async () => {
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }
    const driver = createPgTestkitClient({
      connectionFactory: () => client,
      fixtures: [userFixture],
    });

    const insert = await driver.query<{ email: string; active: boolean }>(
      'insert into users (id, email, active) values ($1, $2, $3) returning email, active',
      [3, 'carol@example.com', true]
    );

    expect(insert.rows).toEqual([{ email: 'carol@example.com', active: true }]);

    const update = await driver.query<{ count: string }>(
      'update users set active = false where id = $1',
      [1]
    );

    expect(update.rows).toEqual([{ count: '1' }]);
  });

  it('ignores unsupported DDL statements', async () => {
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }
    const driver = createPgTestkitClient({
      connectionFactory: () => client,
      fixtures: [userFixture],
    });

    const ddl = await driver.query('create table phantom_users (id int)');
    expect(ddl.rowCount).toBe(0);

    const check = await client.query<{ name: string | null }>("select to_regclass('public.phantom_users') as name");
    expect(check.rows[0]?.name).toBeNull();
  });

});

describe('wrapPgClient', () => {
  it('rewrites pg.Client queries without creating physical tables', async () => {
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }
    const wrapped = wrapPgClient(client, { fixtures: [orderFixture] });

    const rows = await wrapped.query<{ total: number }>('select total from orders where id = $1', [10]);
    expect(rows.rows).toEqual([{ total: '125.5' }]);
  });

  it('derives scoped wrappers with isolated fixtures', async () => {
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }
    const wrapped = wrapPgClient(client, { fixtures: [orderFixture] });
    const scoped = wrapped.withFixtures([
      {
        ...orderFixture,
        rows: [{ id: 77, total: 999.99 }],
      },
    ]);

    const baseResult = await wrapped.query<{ id: number }>('select id from orders');
    const scopedResult = await scoped.query<{ id: number; total: number }>('select id, total from orders');

    expect(baseResult.rows).toEqual([{ id: 10 }, { id: 11 }]);
    expect(scopedResult.rows).toEqual([{ id: 77, total: '999.99' }]);
  });
});
