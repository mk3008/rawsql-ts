import { createConnectionProvider } from '../../src';
import type { ManagedConnection } from '../../src';

const plainFactory = async (): Promise<ManagedConnection> => ({
  query: async <T = unknown>(): Promise<T> => undefined as T,
});

// @ts-expect-error — ManagedConnection without disposeConnection must fail
createConnectionProvider({ connectionFactory: plainFactory });
