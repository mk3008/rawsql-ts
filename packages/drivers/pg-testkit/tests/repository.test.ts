import { Client, ClientBase } from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createPgTestkitClient } from '../src';
import { usersTableDefinition } from './fixtures/TableDefinitions';

declare module 'vitest' {
  interface ProvidedContext {
    /**
     * URI for the Postgres container managed by the Vitest global setup.
     */
    TEST_PG_URI: string;
  }
}

const userRows = [
  { id: 1, email: 'alice@example.com', active: true },
  { id: 2, email: 'bob@example.com', active: false },
];

class UserRepository {
  constructor(private readonly db: ClientBase) {}

  public async createUser(email: string, active: boolean): Promise<{ email: string; active: boolean }> {
    const result = await this.db.query<{ email: string; active: boolean }>(
      'insert into users (email, active) values ($1, $2) returning email, active',
      [email, active]
    );
    return result.rows[0];
  }

  public async findById(id: number): Promise<{ id: number; email: string; active: boolean } | null> {
    const result = await this.db.query<{ id: number; email: string; active: boolean }>(
      'select id, email, active from users where id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }

  public async updateActive(id: number, active: boolean): Promise<number> {
    const result = await this.db.query('update users set active = $2 where id = $1', [id, active]);
    return result.rowCount ?? 0;
  }

  public async deleteById(id: number): Promise<number> {
    const result = await this.db.query('delete from users where id = $1', [id]);
    return result.rowCount ?? 0;
  }

  public async listActive(limit: number): Promise<string[]> {
    const result = await this.db.query<{ email: string }>(
      'select email from users where active = true order by id limit $1',
      [limit]
    );
    return result.rows.map((row: { email: string }) => row.email);
  }
}

describe('UserRepository with pg-testkit driver', () => {
  let client: Client | undefined;
  let driver: ReturnType<typeof createPgTestkitClient> | undefined;

  beforeAll(async () => {
    const pgUri = inject('TEST_PG_URI') ?? process.env.TEST_PG_URI;
    if (!pgUri) {
      throw new Error('TEST_PG_URI is missing; ensure the Vitest global setup provided a connection.');
    }

    client = new Client({ connectionString: pgUri });
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        email text NOT NULL,
        active bool NOT NULL DEFAULT true
      );
    `);
    await client.query('TRUNCATE TABLE users RESTART IDENTITY;');

    driver = createPgTestkitClient({
      connectionFactory: () => client!,
      tableDefinitions: [usersTableDefinition],
      tableRows: [{ tableName: 'users', rows: userRows }],
    });
  });

  afterAll(async () => {
    if (driver) {
      await driver.close();
    }
    if (client) {
      await client.end();
    }
  });

  const buildRepository = (): UserRepository => {
    if (!driver) {
      throw new Error('pg-testkit driver is not initialized');
    }
    return new UserRepository(driver as unknown as ClientBase);
  };

  it('propagates the RETURNING row when inserting a user', async () => {
    const repo = buildRepository();
    const created = await repo.createUser('carol@example.com', true);
    expect(created).toEqual({ email: 'carol@example.com', active: true });
  });

  it('delivers the row count shape for update operations', async () => {
    const repo = buildRepository();
    const updated = await repo.updateActive(2, true);
    expect(updated).toBe(1);
    const updatedNonExists = await repo.updateActive(99, true);
    expect(updatedNonExists).toBe(0);
  });

  it('delivers the row count shape for delete operations', async () => {
    const repo = buildRepository();
    const deleted = await repo.deleteById(2);
    expect(deleted).toBe(1);
    const deletedNonExists = await repo.deleteById(99);
    expect(deletedNonExists).toBe(0);
  });

  it('only uses fixtures to drive SELECT inputs when scoping', async () => {
    const repo = buildRepository();
    if (!driver) {
      throw new Error('pg-testkit driver is unexpectedly undefined');
    }

    const scopedDriver = driver.withFixtures([
      {
        tableName: 'users',
        rows: [{ id: 99, email: 'override@example.com', active: true }],
      },
    ]);

    const scopedRepo = new UserRepository(scopedDriver as unknown as ClientBase);
    const scopedUser = await scopedRepo.findById(99);
    expect(scopedUser).toEqual({ id: 99, email: 'override@example.com', active: true });
  });
});
