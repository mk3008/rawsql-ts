import { createRowsOnlySqlClient } from '@rawsql-ts/driver-adapter-core';
import type { SqlClient } from '#libraries/sql/sql-client.js';

/**
 * Adapt a node-postgres `pg`-style queryable (Client or Pool) into a SqlClient.
 *
 * SQL resources can keep `:name` parameters for readability. The adapter compiles
 * them to node-postgres `$1`, `$2`, ... placeholders immediately before execution.
 *
 * Usage:
 *   // This runtime example uses DATABASE_URL for application code.
 *   // Ashiba itself does not read DATABASE_URL implicitly.
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   const client = fromPg(pool);
 *   const users = await client.query<{ id: number }>('SELECT id ...', []);
 */
export function fromPg(queryable: {
  query(text: string, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}): SqlClient {
  return createRowsOnlySqlClient(queryable, { placeholderStyle: 'pg-indexed' });
}
