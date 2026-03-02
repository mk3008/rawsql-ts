import type {
  ManagedConnection,
  ReleasableConnection,
  ConnectionProvider,
  ReleasableConnectionProviderOptions,
  ManagedConnectionProviderOptions,
} from './types';

// Overload 1: Releasable connections — disposeConnection optional
export function createConnectionProvider<T extends ReleasableConnection>(
  options: ReleasableConnectionProviderOptions<T>
): ConnectionProvider<T>;

// Overload 2: Non-releasable connections — disposeConnection required
export function createConnectionProvider<T extends ManagedConnection>(
  options: ManagedConnectionProviderOptions<T>
): ConnectionProvider<T>;

// Implementation — overloads govern the public type experience;
// the implementation signature is intentionally loose.
export function createConnectionProvider(
  options: ReleasableConnectionProviderOptions<any> | ManagedConnectionProviderOptions<any>
): ConnectionProvider<any> {
  const dispose = async (connection: ManagedConnection): Promise<void> => {
    if (options.disposeConnection) {
      await options.disposeConnection(connection);
    } else if (typeof (connection as any).release === 'function') {
      const release = (connection as any).release as () => void;
      release.call(connection);
    }
    // NOTE: end() is NOT called automatically.
    // end() can be destructive (e.g. permanently closing a standalone client).
    // If you need end() semantics, provide an explicit disposeConnection hook.
  };

  return {
    async withConnection<R>(fn: (connection: any) => Promise<R>): Promise<R> {
      const connection = await options.connectionFactory();
      let primaryError: unknown;
      try {
        return await fn(connection);
      } catch (e) {
        primaryError = e;
        throw e;
      } finally {
        try {
          await dispose(connection);
        } catch (disposeError) {
          if (!primaryError) throw disposeError;
          // Primary error takes precedence; dispose failure is suppressed.
        }
      }
    },

    async withTransaction<R>(fn: (connection: any) => Promise<R>): Promise<R> {
      const connection = await options.connectionFactory();
      let primaryError: unknown;
      try {
        await connection.query('BEGIN');
        const result = await fn(connection);
        await connection.query('COMMIT');
        return result;
      } catch (e) {
        primaryError = e;
        try {
          await connection.query('ROLLBACK');
        } catch {
          // ROLLBACK failure is a secondary fault.
          // The original error is always propagated to the caller.
        }
        throw e;
      } finally {
        try {
          await dispose(connection);
        } catch (disposeError) {
          if (!primaryError) throw disposeError;
          // Primary error takes precedence; dispose failure is suppressed.
        }
      }
    },
  };
}
