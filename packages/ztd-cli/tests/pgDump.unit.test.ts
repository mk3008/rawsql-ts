import { afterEach, describe, expect, test, vi } from 'vitest';

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  spawnSync: spawnSyncMock,
}));

afterEach(() => {
  spawnSyncMock.mockReset();
});

describe('runPgDump', () => {
  test('runs pg_dump through a shell when pgDumpShell is enabled', async () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: 'CREATE TABLE public.accounts (id bigint primary key);',
      stderr: '',
    });

    const { runPgDump } = await import('../src/utils/pgDump');
    const result = runPgDump({
      url: 'postgres://postgres:postgres@localhost:5432/taskdogfood',
      pgDumpPath: 'docker exec ztd-webapi-lifecycle-pg pg_dump',
      pgDumpShell: true,
    });

    expect(result).toContain('CREATE TABLE public.accounts');
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'docker exec ztd-webapi-lifecycle-pg pg_dump',
      ['--schema-only', '--no-owner', '--no-privileges', '--dbname', 'postgres://postgres:postgres@localhost:5432/taskdogfood'],
      expect.objectContaining({
        encoding: 'utf8',
        shell: true,
      }),
    );
  });

  test('includes shell-mode context when the pg_dump command fails to launch', async () => {
    spawnSyncMock.mockReturnValue({
      error: Object.assign(new Error('EINVAL'), { code: 'EINVAL' }),
      status: null,
      stdout: '',
      stderr: '',
    });

    const { runPgDump } = await import('../src/utils/pgDump');

    expect(() =>
      runPgDump({
        url: 'postgres://postgres:postgres@localhost:5432/taskdogfood',
        pgDumpPath: 'docker exec broken-container pg_dump',
        pgDumpShell: true,
      }),
    ).toThrow('shell mode enabled');
  });
});
