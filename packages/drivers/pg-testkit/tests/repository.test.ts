import type { ClientBase } from 'pg';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { createPgTestkitFixtureRunner } from './helpers/pgFixtureRunner';
import { usersTableDefinition } from './fixtures/TableDefinitions';
import { UserRepository } from './sql-app/UserRepository';

type UserRow = { id: number; email: string; active: boolean };

const baseUserRows: UserRow[] = [
  { id: 1, email: 'alice@example.com', active: true },
  { id: 2, email: 'bob@example.com', active: false },
];

/**
 * Helper that drives every repository test through a pg-testkit pool with explicit table metadata.
 * Each run delivers a clean fixture set that prevents shared state between tests.
 */
const fixtureRunner = createPgTestkitFixtureRunner<UserRow>({
  tableDefinitions: [usersTableDefinition],
  buildTableRows: (rows) => [{ tableName: 'users', rows }],
});

describe('UserRepository with pg-testkit driver', () => {
  let connectionString: string | undefined;

  beforeAll(() => {
    connectionString = inject('TEST_PG_URI') ?? process.env.TEST_PG_URI;
    if (!connectionString) {
      throw new Error('TEST_PG_URI is missing; ensure the Vitest global setup provided a connection.');
    }
  });

  const runWithRepository = async (
    rows: UserRow[],
    testFn: (repository: UserRepository) => Promise<void>
  ) => {
    if (!connectionString) {
      throw new Error('Connection string is missing; call beforeAll() before running tests.');
    }

    // Route the pg-testkit pool through each run so SQL is applied to fixture data only.
    await fixtureRunner(connectionString, rows, async (pool) => {
      // Instantiate the repository over the fixture-backed pool so every query uses simulated data.
      const repository = new UserRepository(pool as unknown as ClientBase);
      await testFn(repository);
    });
  };

  it('propagates the RETURNING row when inserting a user', async () => {
    // INSERT ... RETURNING is simulated entirely via fixtures so the repository sees the expected tuple.
    await runWithRepository([], async (repo) => {
      const created = await repo.createUser('carol@example.com', true);
      expect(created).toEqual({ email: 'carol@example.com', active: true });
    });
  });

  it('delivers the row count shape for update operations', async () => {
    // UPDATE rowCount reflects how many fixture rows match, without touching a real table.
    await runWithRepository(baseUserRows, async (repo) => {
      const updated = await repo.updateActive(2, true);
      expect(updated).toBe(1);
      const updatedNonExists = await repo.updateActive(99, true);
      expect(updatedNonExists).toBe(0);
    });
  });

  it('delivers the row count shape for delete operations', async () => {
    // DELETE rowCount relies on fixture matches so observers cannot tell the difference from a real DB.
    await runWithRepository(baseUserRows, async (repo) => {
      const deleted = await repo.deleteById(2);
      expect(deleted).toBe(1);
      const deletedNonExists = await repo.deleteById(99);
      expect(deletedNonExists).toBe(0);
    });
  });

  it('privileges the provided fixtures when resolving SELECTs', async () => {
    // Feeding alternative fixtures proves SELECT queries obey the supplied dataset rather than persisted rows.
    await runWithRepository(
      [{ id: 99, email: 'override@example.com', active: true }],
      async (repo) => {
        const scopedUser = await repo.findById(99);
        expect(scopedUser).toEqual({ id: 99, email: 'override@example.com', active: true });
        const missing = await repo.findById(1);
        expect(missing).toBeNull();
      }
    );
  });
});
