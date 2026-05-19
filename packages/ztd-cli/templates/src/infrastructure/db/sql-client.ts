export type {
  SqlClient,
  SqlNamedParams,
  SqlQueryParameters,
  SqlQueryRows,
} from '@rawsql-ts/driver-adapter-core';

/**
 * Minimal SQL client interface required by the persistence layer.
 *
 * - Production: adapt this interface to your preferred driver (node-postgres, mysql2, etc.) and normalize the results to `T[]`.
 * - SQL files may keep `:name` parameters for readability; driver adapters compile them to the placeholder style required by the driver.
 * - Tests: replace the implementation with a mock, a fixture helper, or an adapter that follows this contract.
 *
 * Connection strategy note:
 * - Prefer one live client per DB context or worker process for better performance.
 * - Multiple clients can coexist in the same workflow as long as each one owns its own lifecycle.
 * - Do not share a live client across parallel workers without proper synchronization.
 */
