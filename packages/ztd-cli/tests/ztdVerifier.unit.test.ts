import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

const {
  closeMock,
  createPostgresTestkitClientMock,
  poolEndMock,
  poolQueryMock
} = vi.hoisted(() => ({
  closeMock: vi.fn().mockResolvedValue(undefined),
  createPostgresTestkitClientMock: vi.fn(),
  poolEndMock: vi.fn().mockResolvedValue(undefined),
  poolQueryMock: vi.fn().mockResolvedValue({ rows: [{ result: 1 }], rowCount: 1 })
}));

vi.mock('pg', () => ({
  Pool: class MockPool {
    query = poolQueryMock;
    end = poolEndMock;
  }
}));

vi.mock('@rawsql-ts/testkit-postgres', () => ({
  createPostgresTestkitClient: createPostgresTestkitClientMock
}));

const tempDirs: string[] = [];
const previousEnv = {
  ZTD_DB_URL: process.env.ZTD_DB_URL,
  ZTD_SQL_TRACE: process.env.ZTD_SQL_TRACE,
  ZTD_SQL_TRACE_DIR: process.env.ZTD_SQL_TRACE_DIR
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  closeMock.mockClear();
  createPostgresTestkitClientMock.mockReset();
  poolEndMock.mockClear();
  poolQueryMock.mockClear();
  if (previousEnv.ZTD_DB_URL === undefined) {
    delete process.env.ZTD_DB_URL;
  } else {
    process.env.ZTD_DB_URL = previousEnv.ZTD_DB_URL;
  }
  if (previousEnv.ZTD_SQL_TRACE === undefined) {
    delete process.env.ZTD_SQL_TRACE;
  } else {
    process.env.ZTD_SQL_TRACE = previousEnv.ZTD_SQL_TRACE;
  }
  if (previousEnv.ZTD_SQL_TRACE_DIR === undefined) {
    delete process.env.ZTD_SQL_TRACE_DIR;
  } else {
    process.env.ZTD_SQL_TRACE_DIR = previousEnv.ZTD_SQL_TRACE_DIR;
  }
  vi.restoreAllMocks();
});

test('verifyQuerySpecZtdCase writes trace artifacts and closes the pool when the assertion fails', async () => {
  const traceDir = mkdtempSync(path.join(tmpdir(), 'ztd-verifier-trace-'));
  tempDirs.push(traceDir);

  process.env.ZTD_DB_URL = 'postgres://localhost:5432/ztd';
  process.env.ZTD_SQL_TRACE = '1';
  process.env.ZTD_SQL_TRACE_DIR = traceDir;

  createPostgresTestkitClientMock.mockImplementation((options: {
    queryExecutor: (sql: string, params: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;
    onExecute?: (sql: string, params: unknown[], fixtures: string[]) => void;
  }) => ({
    async query(sql: string, params: unknown[]) {
      const result = await options.queryExecutor(sql, params);
      options.onExecute?.(sql, params, ['public.users']);
      return result;
    },
    async close() {
      await closeMock();
    }
  }));

  const { verifyQuerySpecZtdCase } = await import('../templates/tests/support/ztd/verifier');

  await expect(
    verifyQuerySpecZtdCase(
      {
        name: 'write-user',
        beforeDb: {},
        input: {},
        output: { ok: true }
      },
      async (client) => {
        await client.query('select :value as value', { value: 1 });
        return { ok: false };
      }
    )
  ).rejects.toThrow();

  expect(createPostgresTestkitClientMock).toHaveBeenCalledTimes(1);
  expect(closeMock).toHaveBeenCalledTimes(1);
  expect(poolEndMock).toHaveBeenCalledTimes(1);

  const traceFiles = readdirSync(traceDir);
  expect(traceFiles).toHaveLength(1);

  const payload = JSON.parse(readFileSync(path.join(traceDir, traceFiles[0] ?? ''), 'utf8')) as {
    caseName: string;
    evidence: { mode: string; executedQueryCount: number; rewriteApplied: boolean };
    failure?: { message?: string };
    trace: Array<{ boundSql: string }>;
  };

  expect(payload.caseName).toBe('write-user');
  expect(payload.evidence).toMatchObject({
    mode: 'ztd',
    executedQueryCount: 1,
    rewriteApplied: true
  });
  expect(payload.failure?.message).toMatch(/expected/i);
  expect(payload.trace).toHaveLength(1);
});
