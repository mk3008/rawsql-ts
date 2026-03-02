import { createConnectionProvider } from '../../src';
import type { ManagedConnection, ReleasableConnection } from '../../src';

// OK: ReleasableConnection — disposeConnection optional
const releasableFactory = async (): Promise<ReleasableConnection> => ({
  query: async <T = unknown>(): Promise<T> => undefined as T,
  release: () => {},
});
createConnectionProvider({ connectionFactory: releasableFactory });

// OK: ReleasableConnection — explicit disposeConnection also allowed
createConnectionProvider({
  connectionFactory: releasableFactory,
  disposeConnection: () => {},
});

// OK: ManagedConnection + explicit disposeConnection
const plainFactory = async (): Promise<ManagedConnection> => ({
  query: async <T = unknown>(): Promise<T> => undefined as T,
});
createConnectionProvider({
  connectionFactory: plainFactory,
  disposeConnection: () => {},
});
