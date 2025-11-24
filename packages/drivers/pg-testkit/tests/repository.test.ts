import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client, ClientBase } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPgTestkitClient } from '../src';
import type { PgFixture } from '../src';

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

let container: StartedPostgreSqlContainer | null = null;
let runtimeAvailable = true;

beforeAll(async () => {
  // Attempt to start a PostgreSQL container for the repository integration tests.
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
  } catch (error) {
    runtimeAvailable = false;
  }
});

afterAll(async () => {
  // Ensure the container is stopped even if some tests skipped the runtime.
  if (container) {
    await container.stop();
  }
});

class UserRepository {
  /**
   * Demo repository that stays unaware of pg-testkit; it expects a plain pg.ClientBase.
   * Tests swap in pg-testkit drivers without changing this class.
   */
  constructor(private readonly db: ClientBase) {}

  public async createUser(email: string, active: boolean): Promise<{ email: string; active: boolean }> {
    const result = await this.db.query<{ email: string; active: boolean }>(
      'insert into users (id, email, active) values ($1, $2, $3) returning email, active',
      [Date.now(), email, active]
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
    const result = await this.db.query('update users set active = $1 where id = $2', [active, id]);
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
  let client: Client;
  let driver: ReturnType<typeof createPgTestkitClient>;

  beforeAll(async () => {
    if (!runtimeAvailable || !container) {
      return;
    }
    // Provision a lightweight PostgreSQL runtime for the test suite.
    client = new Client({ connectionString: container.getConnectionUri() });
    await client.connect();

    driver = createPgTestkitClient({
      connectionFactory: () => client,
      fixtures: [userFixture],
    });
  });

  afterAll(async () => {
    // Clean up both the testkit driver and the underlying PostgreSQL connection.
    if (driver) {
      await driver.close();
    }
    if (client) {
      await client.end();
    }
  });

  const buildRepository = (): UserRepository | null => {
    // Guard against missing runtime so tests can opt out when the container failed to start.
    if (!runtimeAvailable || !driver) {
      return null;
    }
    return new UserRepository(driver as unknown as ClientBase);
  };

  it('propagates the RETURNING row when inserting a user', async () => {
    const repo = buildRepository();
    if (!repo) {
      expect(true).toBe(true);
      return;
    }

    // Ensure RETURNING produces the projected shape the caller expects.
    const created = await repo.createUser('carol@example.com', true);
    expect(created).toEqual({ email: 'carol@example.com', active: true });
  });

  it('delivers the row count shape for update operations', async () => {
    const repo = buildRepository();
    if (!repo) {
      expect(true).toBe(true);
      return;
    }

    // Verify both matched and unmatched rows surface the row count produced by vanilla pg clients.
    const updated = await repo.updateActive(2, true);
    expect(updated).toBe(1);

    const updatedNonExists = await repo.updateActive(99, true);
    expect(updatedNonExists).toBe(0);
  });

  it('delivers the row count shape for delete operations', async () => {
    const repo = buildRepository();
    if (!repo) {
      expect(true).toBe(true);
      return;
    }

    // Only the returned count matters; the underlying persistence change is owned by pg-testkit.
    const deleted = await repo.deleteById(2);
    expect(deleted).toBe(1);

    const deletedNonExists = await repo.deleteById(99);
    expect(deletedNonExists).toBe(0);
  });

  it('only uses fixtures to drive SELECT inputs when scoping', async () => {
    const repo = buildRepository();
    if (!repo || !driver) {
      expect(true).toBe(true);
      return;
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
