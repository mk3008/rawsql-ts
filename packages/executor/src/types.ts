/**
 * Minimal connection interface for managed execution.
 * Structurally compatible with pg.Client, pg.PoolClient, etc.
 * Generic return type avoids per-call casts at the call site.
 */
export interface ManagedConnection {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
}

/**
 * A ManagedConnection that also has a release() method.
 * Connections from pool.connect() typically satisfy this interface.
 * When a connection is Releasable, disposeConnection can be omitted
 * and release() will be called automatically.
 */
export interface ReleasableConnection extends ManagedConnection {
  release(): void;
}

/**
 * Factory that acquires a connection from a pool or creates a new one.
 */
export type ConnectionFactory<T extends ManagedConnection> = () => Promise<T>;

/**
 * Hook to release or dispose a connection after use.
 */
export type ConnectionDisposer<T> = (connection: T) => Promise<void> | void;

/**
 * Provides connection-scoped and transaction-scoped execution.
 */
export interface ConnectionProvider<T extends ManagedConnection> {
  /**
   * Acquires a connection, runs the callback, then releases the connection.
   */
  withConnection<R>(fn: (connection: T) => Promise<R>): Promise<R>;

  /**
   * Acquires a connection, wraps the callback in BEGIN/COMMIT,
   * rolls back on error, then releases the connection.
   */
  withTransaction<R>(fn: (connection: T) => Promise<R>): Promise<R>;
}

/**
 * Options when the connection is Releasable (has release()).
 * disposeConnection is optional — release() is called automatically.
 */
export interface ReleasableConnectionProviderOptions<T extends ReleasableConnection> {
  connectionFactory: ConnectionFactory<T>;
  disposeConnection?: ConnectionDisposer<T>;
}

/**
 * Options when the connection is NOT Releasable.
 * disposeConnection is REQUIRED to prevent connection leaks.
 */
export interface ManagedConnectionProviderOptions<T extends ManagedConnection> {
  connectionFactory: ConnectionFactory<T>;
  disposeConnection: ConnectionDisposer<T>;
}
