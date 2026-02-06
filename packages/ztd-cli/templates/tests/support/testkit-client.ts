import type { SqlClient } from '../../src/db/sql-client';

/**
 * Placeholder for wiring an SQL client that tests can reuse.
 *
 * Replace this implementation with your chosen adapter (pg, mysql2, etc.) or a
 * fixture-based helper that fulfills the `SqlClient` contract. Avoid committing
 * production credentials inside this file.
 */
export async function createTestkitClient(): Promise<SqlClient> {
  throw new Error(
    'Provide a SqlClient implementation here (for example by importing @rawsql-ts/adapter-node-pg or another driver).',
  );
}
