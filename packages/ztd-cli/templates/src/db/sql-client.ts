/**
 * Promise that resolves to the array of rows produced by an SQL query.
 * @template T Shape of each row yielded by the SQL client.
 * @example
 * const rows: SqlQueryRows<{ id: number; name: string }> = client.query('SELECT id, name FROM users');
 */
export type SqlQueryRows<T> = Promise<T[]>;

/**
 * Minimal SQL client interface required by the repository layer.
 *
 * - Production: adapt this interface to your preferred driver (pg, mysql2, etc.) and normalize the results to `T[]`.
 * - Tests: replace the implementation with a mock, a fixture helper, or an adapter that follows this contract.
 *
 * Connection strategy note:
 * - Prefer a shared client per worker process for better performance.
 * - Do not share a live client across parallel workers without proper synchronization.
 */
export type SqlClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): SqlQueryRows<T>;
};
