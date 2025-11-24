import { Client, ClientBase } from 'pg';
import { boolean, pgTable, serial, text } from 'drizzle-orm/pg-core';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createPgTestkitClient } from '../src';
import type { PgFixture } from '../src';

declare module 'vitest' {
  interface ProvidedContext {
    TEST_PG_URI: string;
  }
}

const userFixture: PgFixture = {
  tableName: 'users_drizzle',
  columns: [
    { name: 'id', typeName: 'int', required: true, defaultValue: "nextval('users_drizzle_id_seq'::regclass)" },
    { name: 'email', typeName: 'text', required: true },
    { name: 'active', typeName: 'bool', defaultValue: 'true' },
  ],
  rows: [
    { id: 1, email: 'alice@example.com', active: true },
    { id: 2, email: 'bob@example.com', active: false },
  ],
};

const users = pgTable('users_drizzle', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  active: boolean('active').notNull().default(true),
});

class DrizzleUserRepository {
  constructor(private readonly db: NodePgDatabase) {}

  // Insert a user and return projected fields.
  public async createUser(email: string, active: boolean): Promise<{ email: string; active: boolean }> {
    const result = await this.db.execute(
      sql<{ email: string; active: boolean }>`insert into users_drizzle (email, active) values (${email}, ${active}) returning email, active`
    );
    return result.rows[0];
  }

  // Update a user and surface row count.
  public async updateActive(id: number, active: boolean): Promise<number> {
    const result = await this.db.execute(
      sql`update users_drizzle set active = ${active} where id = ${id}`
    );
    return result.rowCount ?? 0;
  }

  // Delete a user and surface row count.
  public async deleteById(id: number): Promise<number> {
    const result = await this.db.execute(sql`delete from users_drizzle where id = ${id}`);
    return result.rowCount ?? 0;
  }
}

describe('UserRepository with drizzle + pg-testkit driver', () => {
  let client: Client | undefined;
  let driver: ReturnType<typeof createPgTestkitClient> | undefined;
  let db: NodePgDatabase | undefined;

  beforeAll(async () => {
    const pgUri = inject('TEST_PG_URI') ?? process.env.TEST_PG_URI;
    if (!pgUri) {
      throw new Error('TEST_PG_URI is missing; ensure the Vitest global setup provided a connection.');
    }

    client = new Client({ connectionString: pgUri });
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users_drizzle (
        id serial PRIMARY KEY,
        email text NOT NULL,
        active bool NOT NULL DEFAULT true
      );
    `);
    await client.query('TRUNCATE TABLE users_drizzle RESTART IDENTITY;');

    driver = createPgTestkitClient({
      connectionFactory: () => client!,
      fixtures: [userFixture],
    });

    const proxyClient = {
      query: (text: string | { text: string; values?: unknown[]; params?: unknown[] }, values?: unknown[]) => {
        const queryText = typeof text === 'string' ? text : text.text;
        const params = values ?? (typeof text === 'string' ? undefined : text.values ?? text.params);
        return (driver as unknown as ClientBase).query(queryText, params ?? []);
      },
    } as unknown as ClientBase;

    db = drizzle(proxyClient);
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('propagates RETURNING row on insert', async () => {
    const repo = new DrizzleUserRepository(db!);
    const created = await repo.createUser('carol@example.com', true);
    expect(created).toEqual({ email: 'carol@example.com', active: true });
  });

  it('returns row count for updates', async () => {
    const repo = new DrizzleUserRepository(db!);
    const updated = await repo.updateActive(2, true);
    expect(updated).toBe(1);

    const updatedMissing = await repo.updateActive(99, true);
    expect(updatedMissing).toBe(0);
  });

  it('returns row count for deletes', async () => {
    const repo = new DrizzleUserRepository(db!);
    const deleted = await repo.deleteById(2);
    expect(deleted).toBe(1);

    const deletedMissing = await repo.deleteById(99);
    expect(deletedMissing).toBe(0);
  });
});
