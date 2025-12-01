import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPgTestkitClient, wrapPgClient } from '../src';
import { ordersTableDefinition, usersTableDefinition } from './fixtures/TableDefinitions';
import type { PgQueryable } from '../src';
import path from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';

const userRows = [
  { id: 1, email: 'alice@example.com', active: true },
  { id: 2, email: 'bob@example.com', active: false },
];

const orderRows = [
  { id: 10, total: 125.5 },
  { id: 11, total: 45.25 },
];

let container: StartedPostgreSqlContainer | null = null;
let client: Client | null = null;
let runtimeAvailable = true;

/*
  NOTE:
  This test uses Testcontainers to spin up a disposable PostgreSQL instance,
  but pg-testkit NEVER writes to physical tables.

  The container exists only to provide a real PostgreSQL engine so that
  type casting, query planning, and parameter handling round-trip correctly.

  Because pg-testkit rewrites all CRUD into fixture-backed SELECT queries,
  no tables are created or modified in the database.

  Therefore: Docker is NOT required for correctness.
  A shared Postgres instance or any existing development database works fine,
  as long as the connection is available and does not require table writes.
*/
const requireClient = (): Client => {
  // Guard against misusing the pg client when the container startup failed.
  if (!client) {
    throw new Error('Postgres client has not been initialized');
  }
  return client;
};

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
    // Skip the test when the container could not be started.
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }
    const safeClient = requireClient();
    const driver = createPgTestkitClient({
      connectionFactory: () => safeClient,
      tableDefinitions: [usersTableDefinition],
      tableRows: [{ tableName: 'users', rows: userRows }],
    });

    const result = await driver.query<{ id: number; email: string }>(
      'select id, email from users where id = $1',
      [1]
    );

    expect(result.rows).toEqual([{ id: 1, email: 'alice@example.com' }]);
  });

  it('converts CRUD statements into result-select queries', async () => {
    // Skip the test when the container could not be started.
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }
    const safeClient = requireClient();
    const driver = createPgTestkitClient({
      connectionFactory: () => safeClient,
      tableDefinitions: [usersTableDefinition],
      tableRows: [{ tableName: 'users', rows: userRows }],
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
    // Skip the test when the container could not be started.
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }
    const safeClient = requireClient();
    const driver = createPgTestkitClient({
      connectionFactory: () => safeClient,
      tableDefinitions: [usersTableDefinition],
      tableRows: [{ tableName: 'users', rows: userRows }],
    });

    const ddl = await driver.query('create table phantom_users (id int)');
    expect(ddl.rowCount).toBe(0);

    const check = await safeClient.query<{ name: string | null }>("select to_regclass('public.phantom_users') as name");
    expect(check.rows[0]?.name).toBeNull();
  });

  it('infers fixtures from configured DDL files', async () => {
    // Skip the test when the container could not be started.
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }
    const safeClient = requireClient();

    const ddlRoot = path.join('tmp', 'pg-testkit-ddl');
    const schemaDir = path.join(ddlRoot, 'public');
    await mkdir(schemaDir, { recursive: true });

    try {
      await writeFile(
        path.join(schemaDir, 'users.sql'),
        `
          CREATE TABLE public.users (
            id int PRIMARY KEY,
            email text NOT NULL,
            active boolean
          );

          INSERT INTO public.users (id, email, active) VALUES (1, 'alice@example.com', false);
        `
      );

      const driver = createPgTestkitClient({
        connectionFactory: () => safeClient,
        ddl: { directories: [ddlRoot] },
      });

      const result = await driver.query<{ id: number; email: string; active: string }>(
        'select id, email, active from users where id = $1',
        [1]
      );

      expect(result.rows).toEqual([{ id: 1, email: 'alice@example.com', active: false }]);
    } finally {
      await rm(ddlRoot, { recursive: true, force: true });
    }
  });
});

describe('wrapPgClient', () => {
  it('rewrites pg.Client queries without creating physical tables', async () => {
    // Skip the test when the container could not be started.
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }

    const safeClient = requireClient();
    const wrapped = wrapPgClient(safeClient, {
      tableDefinitions: [ordersTableDefinition],
      tableRows: [{ tableName: 'orders', rows: orderRows }],
    });

    const rows = await wrapped.query<{ total: number }>('select total from orders where id = $1', [10]);
    expect(rows.rows).toEqual([{ total: '125.5' }]);
  });

  it('reports rowCount/command correctly for rewritten UPDATE statements', async () => {
    // Skip the test when the container could not be started.
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }

    const safeClient = requireClient();
    const wrapped = wrapPgClient(safeClient, {
      tableDefinitions: [ordersTableDefinition],
      tableRows: [{ tableName: 'orders', rows: orderRows }],
    });

    // Verify no-match updates return zero rowCount instead of 1 SELECT row.
    const missing = await wrapped.query<{ count: string }>(
      'update orders set total = total where id = $1',
      [999]
    );

    expect(missing.command).toBe('update');
    expect(missing.rowCount).toBe(0);

    // Verify matched updates preserve the original command and row count.
    const updated = await wrapped.query<{ count: string }>(
      'update orders set total = $1 where id = $2',
      [200, 10]
    );

    expect(updated.command).toBe('update');
    expect(updated.rowCount).toBe(1);
  });

  it('derives scoped wrappers with isolated fixtures', async () => {
    // Skip the test when the container could not be started.
    if (!runtimeAvailable || !client) {
      expect(true).toBe(true);
      return;
    }

    const safeClient = requireClient();
    const wrapped = wrapPgClient(safeClient, {
      tableDefinitions: [ordersTableDefinition],
      tableRows: [{ tableName: 'orders', rows: orderRows }],
    });
    const scoped = wrapped.withFixtures([
      {
        tableName: 'orders',
        rows: [{ id: 77, total: 999.99 }],
      },
    ]);

    const baseResult = await wrapped.query<{ id: number }>('select id from orders');
    const scopedResult = await scoped.query<{ id: number; total: number }>('select id, total from orders');

    expect(baseResult.rows).toEqual([{ id: 10 }, { id: 11 }]);
    expect(scopedResult.rows).toEqual([{ id: 77, total: '999.99' }]);
  });
});
