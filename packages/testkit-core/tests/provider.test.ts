import { describe, expect, test } from 'vitest';
import {
  createTestkitProvider,
  TestkitConnection,
} from '../src/provider/TestkitProvider';

class FakeConnection implements TestkitConnection {
  static nextId = 1;
  public readonly id: number;
  public readonly queries: string[] = [];
  public disposed = false;

  constructor() {
    this.id = FakeConnection.nextId++;
  }

  public async query(sql: string) {
    this.queries.push(sql);
  }

  public release() {
    this.disposed = true;
  }
}

describe('TestkitProvider', () => {
  test('shared strategy reuses a single connection and wraps every call in BEGIN/ROLLBACK', async () => {
    const connections: FakeConnection[] = [];
    const provider = await createTestkitProvider({
      connectionFactory: async () => {
        const connection = new FakeConnection();
        connections.push(connection);
        return connection;
      },
      resourceFactory: async () => ({}) satisfies Record<string, unknown>,
    });

    try {
      // Run the shared scenario twice so the same connection services both calls.
      await provider.withRepositoryFixture([], async () => undefined);
      await provider.withRepositoryFixture([], async () => undefined);
      expect(connections).toHaveLength(1);
      expect(connections[0].queries).toEqual([
        'BEGIN',
        'ROLLBACK',
        'BEGIN',
        'ROLLBACK',
      ]);
    } finally {
      await provider.close();
    }
  });

  test('perTest strategy creates and disposes a connection for each invocation', async () => {
    const connections: FakeConnection[] = [];
    const disposed: number[] = [];
    const provider = await createTestkitProvider({
      connectionFactory: async () => {
        const connection = new FakeConnection();
        connections.push(connection);
        return connection;
      },
      resourceFactory: async () => ({}) satisfies Record<string, unknown>,
      disposeConnection: async (connection) => {
        disposed.push(connection.id);
        await connection.release();
      },
    });

    try {
      // Force the per-test strategy so every call gets its own connection lifecycle.
      await provider.withRepositoryFixture([], async () => undefined, {
        strategy: 'perTest',
      });
      await provider.withRepositoryFixture([], async () => undefined, {
        strategy: 'perTest',
      });
      expect(connections).toHaveLength(2);
      expect(disposed).toEqual([connections[0].id, connections[1].id]);
    } finally {
      await provider.close();
    }
  });

  test('perTest helper always applies the per-test override', async () => {
    const connections: FakeConnection[] = [];
    const provider = await createTestkitProvider({
      connectionFactory: async () => {
        const connection = new FakeConnection();
        connections.push(connection);
        return connection;
      },
      resourceFactory: async () => ({}) satisfies Record<string, unknown>,
    });

    try {
      // Use provider.perTest() to sidestep the shared connection path entirely.
      await provider.perTest().withRepositoryFixture(
        [],
        async () => undefined
      );
      await provider.perTest().withRepositoryFixture(
        [],
        async () => undefined
      );
      expect(connections).toHaveLength(2);
    } finally {
      await provider.close();
    }
  });

  test('custom reset hook runs after each shared scenario', async () => {
    const connections: FakeConnection[] = [];
    const resetCalls: FakeConnection[] = [];
    const provider = await createTestkitProvider({
      connectionFactory: async () => {
        const connection = new FakeConnection();
        connections.push(connection);
        return connection;
      },
      resourceFactory: async () => ({}) satisfies Record<string, unknown>,
      reset: async (connection) => {
        resetCalls.push(connection);
      },
    });

    try {
      await provider.withRepositoryFixture([], async () => undefined);
      expect(resetCalls).toHaveLength(1);
      expect(resetCalls[0]).toBe(connections[0]);
      expect(connections[0].queries).toEqual([]);
    } finally {
      await provider.close();
    }
  });
});
