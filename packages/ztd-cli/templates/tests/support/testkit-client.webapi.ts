import type { SqlClient } from '../../src/infrastructure/db/sql-client.js';

/**
 * Placeholder for wiring an SQL client that tests can reuse.
 *
 * Replace this implementation with your chosen adapter (pg, mysql2, etc.) or a
 * fixture-based helper that fulfills the `SqlClient` contract. Avoid committing
 * production credentials inside this file.
 */
export async function createTestkitClient(): Promise<SqlClient> {
  throw new Error(
    'Provide a SqlClient implementation here (for example by adapting pg via src/infrastructure/db/sql-client-adapters.ts, or by importing @rawsql-ts/adapter-node-pg for ZTD-backed tests).',
  );
}
