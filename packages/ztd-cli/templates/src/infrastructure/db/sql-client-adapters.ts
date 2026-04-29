import type { SqlClient } from './sql-client.js';

/**
 * Adapt a `pg`-style queryable (Client or Pool) into a SqlClient.
 *
 * pg's `query()` returns `QueryResult<T>` with a `.rows` property.
 * This helper unwraps the result so it satisfies the `SqlClient` contract.
 *
 * Usage:
 *   // This runtime example uses DATABASE_URL for application code.
 *   // ztd-cli itself does not read DATABASE_URL implicitly.
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   const client = fromPg(pool);
 *   const users = await client.query<{ id: number }>('SELECT id ...', []);
 */
export function fromPg(
  queryable: {
    query(text: string, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  }
): SqlClient {
  return {
    query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: readonly unknown[]
    ): Promise<T[]> {
      return queryable.query(text, values).then((result) => result.rows as T[]);
    }
  };
}
