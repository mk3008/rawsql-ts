import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

const tempDirs: string[] = [];
const originalTestDatabaseUrl = process.env.ZTD_TEST_DATABASE_URL;
const originalDbPort = process.env.ZTD_DB_PORT;

function restoreEnv(key: 'ZTD_TEST_DATABASE_URL' | 'ZTD_DB_PORT', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

afterEach(() => {
  restoreEnv('ZTD_TEST_DATABASE_URL', originalTestDatabaseUrl);
  restoreEnv('ZTD_DB_PORT', originalDbPort);
  vi.resetModules();
  vi.restoreAllMocks();

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('setup-env prefers ZTD_DB_PORT over a stale test database URL', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-setup-env-port-'));
  tempDirs.push(rootDir);
  writeFileSync(path.join(rootDir, '.env'), 'ZTD_DB_PORT=5433\n', 'utf8');

  vi.spyOn(process, 'cwd').mockReturnValue(rootDir);
  process.env.ZTD_TEST_DATABASE_URL = 'postgres://ztd:ztd@localhost:5432/ztd';
  delete process.env.ZTD_DB_PORT;

  await import('../templates/tests/support/setup-env');

  expect(process.env.ZTD_DB_PORT).toBe('5433');
  expect(process.env.ZTD_TEST_DATABASE_URL).toBe('postgres://ztd:ztd@localhost:5433/ztd');
});

test('setup-env keeps an explicit test database URL when no port override is present', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-setup-env-url-'));
  tempDirs.push(rootDir);

  vi.spyOn(process, 'cwd').mockReturnValue(rootDir);
  process.env.ZTD_TEST_DATABASE_URL = 'postgres://ztd:ztd@localhost:5440/ztd';
  delete process.env.ZTD_DB_PORT;

  await import('../templates/tests/support/setup-env');

  expect(process.env.ZTD_TEST_DATABASE_URL).toBe('postgres://ztd:ztd@localhost:5440/ztd');
});
