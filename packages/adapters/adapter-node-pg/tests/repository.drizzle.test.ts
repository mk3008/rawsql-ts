import type { TableRowsFixture } from '@rawsql-ts/testkit-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { createPgTestkitFixtureRunner } from './helpers/pgFixtureRunner';
import { usersDrizzleTableDefinition } from './fixtures/TableDefinitions';
import { DrizzleUserRepository } from './drizzle-app/DrizzleUserRepository';

type DrizzleRow = { id: number; email: string; active: boolean };
const baseDrizzleRows: DrizzleRow[] = [
  { id: 1, email: 'alice@example.com', active: true },
  { id: 2, email: 'bob@example.com', active: false },
];

const buildDrizzleFixtures = (rows: DrizzleRow[]): TableRowsFixture[] => [
  { tableName: 'users_drizzle', rows },
];

/**
 * Prepares fixture-backed execution for every test so pg-testkit rewrites
 * CRUD operations into SELECT plans that derive their data from fixtures.
 */
const fixtureRunner = createPgTestkitFixtureRunner({
  tableDefinitions: [usersDrizzleTableDefinition],
});

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

    // Build the fixture payload so the runner can handle multi-table configurations.
    const fixtures = buildDrizzleFixtures(rows);

    // Start a fixture-driven pool so each test sees only the provided data.
    await fixtureRunner(connectionString, fixtures, async (pool) => {
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
