import { sql } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { createPgTestkitFixtureRunner } from './helpers/pgFixtureRunner';
import { usersDrizzleTableDefinition } from './fixtures/TableDefinitions';

type DrizzleRow = { id: number; email: string; active: boolean };
const baseDrizzleRows: DrizzleRow[] = [
  { id: 1, email: 'alice@example.com', active: true },
  { id: 2, email: 'bob@example.com', active: false },
];

/**
 * Prepares fixture-backed execution for every test so pg-testkit rewrites
 * CRUD operations into SELECT plans that derive their data from fixtures.
 */
const fixtureRunner = createPgTestkitFixtureRunner<DrizzleRow>({
  tableDefinitions: [usersDrizzleTableDefinition],
  buildTableRows: (rows) => [{ tableName: 'users_drizzle', rows }],
});

/** Plain SQL repository that exercises inserts, updates, and deletes via Drizzle. */
class DrizzleUserRepository {
  constructor(private readonly db: NodePgDatabase) {}

  /**
   * INSERT ... RETURNING is rewritten to a fixture-backed SELECT so the returned
   * tuple comes entirely from pg-testkit instead of a physical write.
   */
  public async createUser(email: string, active: boolean): Promise<{ email: string; active: boolean }> {
    // Run the INSERT statement the test would normally issue; pg-testkit captures
    // the SQL and synthesizes a returning row based on the current fixtures.
    const result = await this.db.execute(
      sql<{ email: string; active: boolean }>`
        insert into users_drizzle (email, active)
        values (${email}, ${active})
        returning email, active
      `
    );
    return result.rows[0] as { email: string; active: boolean };
  }

  /**
   * UPDATE is rewritten so rowCount reflects how many fixture rows the
   * WHERE clause matches, without touching a real table.
   */
  public async updateActive(id: number, active: boolean): Promise<number> {
    // Execute the SQL that would update the table; pg-testkit evaluates the
    // WHERE clause against the fixtures and returns a synthesized rowCount.
    const result = await this.db.execute(sql`update users_drizzle set active = ${active} where id = ${id}`);
    return result.rowCount ?? 0;
  }

  /**
   * DELETE is treated similarly: pg-testkit computes rowCount from fixtures.
   */
  public async deleteById(id: number): Promise<number> {
    // The SQL itself is unchanged, but pg-testkit runs it against the fixtures
    // so the method proves rowCount still matches the logical dataset.
    const result = await this.db.execute(sql`delete from users_drizzle where id = ${id}`);
    return result.rowCount ?? 0;
  }
}

describe('UserRepository with drizzle + pg-testkit driver', () => {
  let connectionString: string | undefined;

  beforeAll(() => {
    /**
     * Vitest injects the TEST_PG_URI connection string so fixture-backed tests
     * can instantiate a pg-testkit pool without touching physical tables.
     */
    connectionString = inject('TEST_PG_URI') ?? process.env.TEST_PG_URI;
    if (!connectionString) {
      throw new Error('TEST_PG_URI is missing; ensure the Vitest global setup provided a connection.');
    }
  });

  /**
   * Helper that runs repository tests under pg-testkit simulation with the given rows.
   */
  const runWithRepository = async (
    rows: DrizzleRow[],
    testFn: (repository: DrizzleUserRepository) => Promise<void>
  ) => {
    if (!connectionString) {
      throw new Error('Connection string is missing; call beforeAll() before running tests.');
    }

    // Start a fixture-driven pool so each test sees only the provided data.
    await fixtureRunner(connectionString, rows, async (pool) => {
      const db = drizzle(pool);
      const repository = new DrizzleUserRepository(db);
      await testFn(repository);
    });
  };

  it('propagates RETURNING row on insert', async () => {
    /**
     * INSERT ... RETURNING is rewritten to SELECT-only CTEs that synthesize the
     * same returned tuple, proving the repository receives the expected shape.
     */
    await runWithRepository([], async (repo) => {
      const created = await repo.createUser('carol@example.com', true);
      expect(created).toEqual({ email: 'carol@example.com', active: true });
    });
  });

  it('returns row count for updates', async () => {
    /**
     * UPDATE rowCount is derived exclusively from fixture matches so all behavior
     * stays deterministic even though the table is never mutated.
     */
    await runWithRepository(baseDrizzleRows, async (repo) => {
      const updated = await repo.updateActive(2, true);
      expect(updated).toBe(1);

      const updatedMissing = await repo.updateActive(99, true);
      expect(updatedMissing).toBe(0);
    });
  });

  it('returns row count for deletes', async () => {
    /**
     * DELETE rowCount is computed the same way as UPDATE, ensuring the SQL alone
     * determines the observable result without side effects.
     */
    await runWithRepository(baseDrizzleRows, async (repo) => {
      const deleted = await repo.deleteById(2);
      expect(deleted).toBe(1);

      const deletedMissing = await repo.deleteById(99);
      expect(deletedMissing).toBe(0);
    });
  });
});
