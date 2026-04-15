/**
 * Promise that resolves to the array of rows produced by an SQL query.
 * @template T Shape of each row yielded by the SQL client.
 * @example
 * const rows: SqlQueryRows<{ id: number; name: string }> = client.query('SELECT id, name FROM users');
 */
export type SqlQueryRows<T> = Promise<T[]>;

/**
 * Minimal SQL client contract shared by the app and adapter boundaries.
 *
 * - Production: adapt this contract to your preferred driver (pg, mysql2, etc.) and normalize the results to `T[]`.
 * - Tests: replace the implementation with a mock, a fixture helper, or an adapter that follows this contract.
 *
 * Connection strategy note:
 * - Prefer one live client per DB context or worker process for better performance.
 * - Multiple clients can coexist in the same workflow as long as each one owns its own lifecycle.
 * - Do not share a live client across parallel workers without proper synchronization.
 */
export type SqlClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[] | Record<string, unknown>
  ): SqlQueryRows<T>;
};
