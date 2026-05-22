import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

const {
  closeMock,
  createPostgresTestkitClientMock,
  poolClientQueryMock,
  poolClientReleaseMock,
  poolConnectMock,
  poolEndMock,
  poolQueryMock
} = vi.hoisted(() => ({
  closeMock: vi.fn().mockResolvedValue(undefined),
  createPostgresTestkitClientMock: vi.fn(),
  poolClientQueryMock: vi.fn().mockResolvedValue({ rows: [{ result: 1 }], rowCount: 1 }),
  poolClientReleaseMock: vi.fn(),
  poolConnectMock: vi.fn(),
  poolEndMock: vi.fn().mockResolvedValue(undefined),
  poolQueryMock: vi.fn().mockResolvedValue({ rows: [{ result: 1 }], rowCount: 1 })
}));

vi.mock('pg', () => ({
  Pool: class MockPool {
    query = poolQueryMock;
    connect = poolConnectMock;
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
  poolClientQueryMock.mockClear();
  poolClientReleaseMock.mockClear();
  poolConnectMock.mockReset();
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

test('verifyQuerySpecZtdCase explains how to create ZTD_DB_URL when the starter DB env is missing', async () => {
  delete process.env.ZTD_DB_URL;

  const { verifyQuerySpecZtdCase } = await import('../templates/tests/support/ztd/verifier');

  await expect(
    verifyQuerySpecZtdCase(
      {
        name: 'missing-db-url',
        beforeDb: {},
        input: {},
        output: { ok: true }
      },
      async () => ({ ok: true })
    )
  ).rejects.toThrow(/Copy `\.env\.example` to `\.env`/);
});

test('verifyQuerySpecTraditionalCase adds starter recovery steps when Postgres is unreachable', async () => {
  process.env.ZTD_DB_URL = 'postgres://ztd:ztd@localhost:55433/ztd';
  const connectionError = new Error('connect ECONNREFUSED 127.0.0.1:55433') as Error & { code?: string };
  connectionError.code = 'ECONNREFUSED';
  poolConnectMock.mockRejectedValue(connectionError);

  const { verifyQuerySpecTraditionalCase } = await import('../templates/tests/support/ztd/verifier');

  await expect(
    verifyQuerySpecTraditionalCase(
      {
        name: 'db-down',
        beforeDb: {},
        input: {},
        output: { ok: true }
      },
      async () => ({ ok: true })
    )
  ).rejects.toThrow(/localhost:55433[\s\S]*docker compose up -d/);
});

test('verifyQuerySpecTraditionalCase physically prepares fixtures and returns traditional evidence', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-verifier-project-'));
  tempDirs.push(rootDir);
  writeFileSync(
    path.join(rootDir, 'ztd.config.json'),
    JSON.stringify({
      defaultSchema: ' public ',
      searchPath: [' app ', '', ' $user ', ' pg_temp ', ' pg_temp_3 ', ' public ']
    }),
    'utf8'
  );
  vi.spyOn(process, 'cwd').mockReturnValue(rootDir);

  process.env.ZTD_DB_URL = 'postgres://localhost:5432/ztd';

  poolConnectMock.mockResolvedValue({
    query: poolClientQueryMock,
    release: poolClientReleaseMock
  });
  poolClientQueryMock.mockImplementation((sql: string) => {
    if (sql.includes('SELECT * FROM')) {
      return Promise.resolve({ rows: [{ user_id: 1, email: 'alice@example.com' }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [{ ok: true }], rowCount: 1 });
  });

  const { verifyQuerySpecTraditionalCase } = await import('../templates/tests/support/ztd/verifier');

  const evidence = await verifyQuerySpecTraditionalCase(
    {
      name: 'traditional-read',
      beforeDb: {
        public: {
          users: [{ user_id: 1, email: 'alice@example.com' }]
        }
      },
      input: { userId: 1 },
      output: [{ ok: true }],
      afterDb: {
        public: {
          users: [{ user_id: 1, email: 'alice@example.com' }]
        }
      }
    },
    (client, input) =>
      client.query(
        "select 'public.users' as literal, true as ok from public.users -- public.comment_table\nwhere note = $$public.dollar_table$$ and user_id = :userId",
        input
      )
  );

  expect(evidence).toMatchObject({
    mode: 'traditional',
    rewriteApplied: false,
    physicalSetupUsed: true,
    executedQueryCount: 1
  });
  expect(poolConnectMock).toHaveBeenCalledTimes(1);
  expect(poolClientQueryMock).toHaveBeenCalledWith(expect.stringMatching(/^CREATE SCHEMA/));
  expect(poolClientQueryMock).toHaveBeenCalledWith(
    expect.stringMatching(/^SET search_path TO "ztd_traditional_[^"]+", "app", \$user, pg_temp, pg_temp_3, "public"$/)
  );
  expect(poolClientQueryMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), [1, 'alice@example.com']);
  expect(poolClientQueryMock).toHaveBeenCalledWith(expect.stringContaining("'public.users' as literal"), [1]);
  const executedQuery = poolClientQueryMock.mock.calls
    .map((call) => String(call[0]))
    .find((sql) => sql.includes("'public.users' as literal"));
  expect(executedQuery).toBeDefined();
  expect(executedQuery).toContain("'public.users' as literal");
  expect(executedQuery).toContain('-- public.comment_table');
  expect(executedQuery).toContain('$$public.dollar_table$$');
  expect(executedQuery).toMatch(/from "ztd_traditional_[^"]+"\.users/);
  expect(executedQuery).not.toContain('from public.users');
  expect(poolClientQueryMock).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM'));
  expect(poolClientQueryMock).toHaveBeenCalledWith(expect.stringMatching(/^DROP SCHEMA IF EXISTS/));
  expect(poolClientReleaseMock).toHaveBeenCalledTimes(1);
  expect(poolEndMock).toHaveBeenCalledTimes(1);
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
