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
 * - Production: adapt `pg` (or other drivers) to normalize results into `T[]`
 * - Tests: compatible with the `testkit-postgres` pipeline exposed by `@rawsql-ts/adapter-node-pg` clients returned by `createTestkitClient()`
 *
 * Connection strategy note:
 * - Prefer a shared client per worker process for performance.
 * - Do not share a live client across parallel workers.
 */
export type SqlClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): SqlQueryRows<T>;
};
