import type { SqlClient } from './sql-client';

/**
 * Adapt a `pg`-style queryable (Client or Pool) into a SqlClient.
 *
 * pg's `query()` returns `QueryResult<T>` with a `.rows` property.
 * This helper unwraps the result so it satisfies the `SqlClient` contract.
 *
 * Usage:
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
      values?: readonly unknown[] | Record<string, unknown>
    ): Promise<T[]> {
      if (values != null && !Array.isArray(values)) {
        throw new Error('fromPg adapter does not support named parameter objects; use positional parameter arrays');
      }
      return queryable
        .query(text, values as readonly unknown[])
        .then((result) => result.rows as T[]);
    }
  };
}
