import { Client, ClientBase } from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createPgTestkitClient } from '../src';
import type { PgFixture } from '../src';

declare module 'vitest' {
  interface ProvidedContext {
    /**
     * URI for the Postgres container managed by the Vitest global setup.
     */
    TEST_PG_URI: string;
  }
}

const userFixture: PgFixture = {
  tableName: 'users',
  columns: [
    {
      name: 'id',
      typeName: 'int',
      required: true,
      defaultValue: "nextval('users_id_seq'::regclass)",
    },
    { name: 'email', typeName: 'text' },
    { name: 'active', typeName: 'bool', defaultValue: 'true' },
  ],
  rows: [
    { id: 1, email: 'alice@example.com', active: true },
    { id: 2, email: 'bob@example.com', active: false },
  ],
};

class UserRepository {
  /**
   * Demo repository that stays unaware of pg-testkit; it expects a plain pg.ClientBase.
   * Tests swap in pg-testkit drivers without changing this class.
   */
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
    // Fail early if the global setup did not provide a Postgres URI.
    const pgUri = inject('TEST_PG_URI') ?? process.env.TEST_PG_URI;
    if (!pgUri) {
      throw new Error('TEST_PG_URI is missing; ensure the Vitest global setup provided a connection.');
    }

    // Reuse the shared connection string to open a pg Client for the suite.
    client = new Client({ connectionString: pgUri });
    await client.connect();

    // Prepare a minimal users table so Postgres can resolve column types.
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        email text NOT NULL,
        active bool NOT NULL DEFAULT true
      );
    `);
    await client.query('TRUNCATE TABLE users RESTART IDENTITY;');

    // Wrap the persistent client in a pg-testkit driver with the shared fixtures.
    driver = createPgTestkitClient({
      connectionFactory: () => client!,
      fixtures: [userFixture],
    });
  });

  afterAll(async () => {
    // Dispose the driver so it stops managing fixtures before the client closes.
    if (driver) {
      await driver.close();
    }

    // Terminate the Client connection to release the Postgres session.
    if (client) {
      await client.end();
    }
  });

  const buildRepository = (): UserRepository => {
    // Guard against misconfigured test suites that failed to initialize the driver.
    if (!driver) {
      throw new Error('pg-testkit driver is not initialized');
    }
    return new UserRepository(driver as unknown as ClientBase);
  };

  it('propagates the RETURNING row when inserting a user', async () => {
    const repo = buildRepository();

    // Ensure RETURNING produces the projected shape the caller expects.
    const created = await repo.createUser('carol@example.com', true);
    expect(created).toEqual({ email: 'carol@example.com', active: true });
  });

  it('delivers the row count shape for update operations', async () => {
    const repo = buildRepository();

    // Verify both matched and unmatched rows surface the row count produced by vanilla pg clients.
    const updated = await repo.updateActive(2, true);
    expect(updated).toBe(1);

    const updatedNonExists = await repo.updateActive(99, true);
    expect(updatedNonExists).toBe(0);
  });

  it('delivers the row count shape for delete operations', async () => {
    const repo = buildRepository();

    // Only the returned count matters; the underlying persistence change is owned by pg-testkit.
    const deleted = await repo.deleteById(2);
    expect(deleted).toBe(1);

    const deletedNonExists = await repo.deleteById(99);
    expect(deletedNonExists).toBe(0);
  });

  it('only uses fixtures to drive SELECT inputs when scoping', async () => {
    const repo = buildRepository();

    // Double-check the shared driver before creating a scoped driver slice.
    if (!driver) {
      throw new Error('pg-testkit driver is unexpectedly undefined');
    }

    const scopedDriver = driver.withFixtures([
      {
        ...userFixture,
        rows: [{ id: 99, email: 'override@example.com', active: true }],
      },
    ]);

    const scopedRepo = new UserRepository(scopedDriver as unknown as ClientBase);

    // Reading through the repository should reflect the fixture override without asserting persistence.
    const scopedUser = await scopedRepo.findById(99);
    expect(scopedUser).toEqual({ id: 99, email: 'override@example.com', active: true });
  });
});
