import { describe, it, expect, vi } from 'vitest';
import { createConnectionProvider } from '../src';
import type { ManagedConnection, ReleasableConnection } from '../src';

function createMockReleasable(overrides?: Partial<ReleasableConnection>): ReleasableConnection {
  return {
    query: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
    ...overrides,
  };
}

function createMockManaged(overrides?: Partial<ManagedConnection>): ManagedConnection {
  return {
    query: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createConnectionProvider', () => {
  describe('withConnection', () => {
    it('acquires a connection, runs the callback, then releases', async () => {
      const conn = createMockReleasable();
      const provider = createConnectionProvider({
        connectionFactory: async () => conn,
      });

      await provider.withConnection(async (c) => {
        expect(c).toBe(conn);
      });

      expect(conn.release).toHaveBeenCalledOnce();
    });

    it('releases the connection even when the callback throws', async () => {
      const conn = createMockReleasable();
      const provider = createConnectionProvider({
        connectionFactory: async () => conn,
      });

      await expect(
        provider.withConnection(async () => {
          throw new Error('callback error');
        })
      ).rejects.toThrow('callback error');

      expect(conn.release).toHaveBeenCalledOnce();
    });

    it('returns the callback result', async () => {
      const conn = createMockReleasable();
      const provider = createConnectionProvider({
        connectionFactory: async () => conn,
      });

      const result = await provider.withConnection(async () => 42);
      expect(result).toBe(42);
    });
  });

  describe('withTransaction', () => {
    it('executes BEGIN, callback, COMMIT in order', async () => {
      const calls: string[] = [];
      const conn = createMockReleasable({
        query: vi.fn().mockImplementation(async (sql: string) => {
          calls.push(sql);
        }),
      });
      const provider = createConnectionProvider({
        connectionFactory: async () => conn,
      });

      await provider.withTransaction(async (c) => {
        await c.query('INSERT INTO t VALUES (1)');
      });

      expect(calls).toEqual(['BEGIN', 'INSERT INTO t VALUES (1)', 'COMMIT']);
      expect(conn.release).toHaveBeenCalledOnce();
    });

    it('executes ROLLBACK on callback error, releases connection, and propagates the original error', async () => {
      const calls: string[] = [];
      const conn = createMockReleasable({
        query: vi.fn().mockImplementation(async (sql: string) => {
          calls.push(sql);
        }),
      });
      const provider = createConnectionProvider({
        connectionFactory: async () => conn,
      });

      await expect(
        provider.withTransaction(async () => {
          throw new Error('tx error');
        })
      ).rejects.toThrow('tx error');

      expect(calls).toEqual(['BEGIN', 'ROLLBACK']);
      expect(conn.release).toHaveBeenCalledOnce();
    });

    it('propagates the original error even when ROLLBACK fails', async () => {
      let callCount = 0;
      const conn = createMockReleasable({
        query: vi.fn().mockImplementation(async (sql: string) => {
          callCount++;
          if (sql === 'ROLLBACK') {
            throw new Error('rollback failed');
          }
        }),
      });
      const provider = createConnectionProvider({
        connectionFactory: async () => conn,
      });

      await expect(
        provider.withTransaction(async () => {
          throw new Error('original error');
        })
      ).rejects.toThrow('original error');

      expect(conn.release).toHaveBeenCalledOnce();
    });

    it('returns the callback result on success', async () => {
      const conn = createMockReleasable();
      const provider = createConnectionProvider({
        connectionFactory: async () => conn,
      });

      const result = await provider.withTransaction(async () => 'tx-result');
      expect(result).toBe('tx-result');
    });
  });

  describe('disposeConnection', () => {
    it('calls custom disposeConnection instead of release()', async () => {
      const conn = createMockReleasable();
      const dispose = vi.fn();
      const provider = createConnectionProvider({
        connectionFactory: async () => conn,
        disposeConnection: dispose,
      });

      await provider.withConnection(async () => {});

      expect(dispose).toHaveBeenCalledWith(conn);
      expect(conn.release).not.toHaveBeenCalled();
    });

    it('calls release() automatically for ReleasableConnection when disposeConnection is omitted', async () => {
      const conn = createMockReleasable();
      const provider = createConnectionProvider({
        connectionFactory: async () => conn,
      });

      await provider.withConnection(async () => {});

      expect(conn.release).toHaveBeenCalledOnce();
    });

    it('calls custom disposeConnection for non-releasable connections', async () => {
      const conn = createMockManaged();
      const dispose = vi.fn();
      const provider = createConnectionProvider({
        connectionFactory: async () => conn,
        disposeConnection: dispose,
      });

      await provider.withConnection(async () => {});

      expect(dispose).toHaveBeenCalledWith(conn);
    });
  });
});
