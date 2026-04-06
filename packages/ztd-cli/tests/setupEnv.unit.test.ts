import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

const DB_ENV_KEYS = ['ZTD_DB_HOST', 'ZTD_DB_PORT', 'ZTD_DB_NAME', 'ZTD_DB_USER', 'ZTD_DB_PASS'] as const;
const tempDirs: string[] = [];
const originalEnv = Object.fromEntries(
  [...DB_ENV_KEYS, 'ZTD_TEST_DATABASE_URL'].map((key) => [key, process.env[key]])
) as Record<(typeof DB_ENV_KEYS)[number] | 'ZTD_TEST_DATABASE_URL', string | undefined>;

function restoreEnv(key: keyof typeof originalEnv, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function writeStarterEnv(rootDir: string, overrides: Partial<Record<(typeof DB_ENV_KEYS)[number], string>> = {}): void {
  const envLines = DB_ENV_KEYS.map((key) => `${key}=${overrides[key] ?? defaultValueFor(key)}`);
  writeFileSync(path.join(rootDir, '.env'), `${envLines.join('\n')}\n`, 'utf8');
}

function defaultValueFor(key: (typeof DB_ENV_KEYS)[number]): string {
  switch (key) {
    case 'ZTD_DB_HOST':
      return '127.0.0.1';
    case 'ZTD_DB_PORT':
      return '5433';
    case 'ZTD_DB_NAME':
      return 'ztd';
    case 'ZTD_DB_USER':
      return 'ztd';
    case 'ZTD_DB_PASS':
      return 'ztd';
  }
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv) as Array<[keyof typeof originalEnv, string | undefined]>) {
    restoreEnv(key, value);
  }
  vi.resetModules();
  vi.restoreAllMocks();

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('setup-env derives ZTD_TEST_DATABASE_URL from the starter DB env vars', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-setup-env-derived-'));
  tempDirs.push(rootDir);
  writeStarterEnv(rootDir);

  vi.spyOn(process, 'cwd').mockReturnValue(rootDir);
  delete process.env.ZTD_TEST_DATABASE_URL;

  await import('../templates/tests/support/setup-env');

  expect(process.env.ZTD_TEST_DATABASE_URL).toBe('postgres://ztd:ztd@127.0.0.1:5433/ztd');
});

test('setup-env fails fast when ZTD_TEST_DATABASE_URL conflicts with the starter DB env vars', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-setup-env-conflict-'));
  tempDirs.push(rootDir);
  writeStarterEnv(rootDir, { ZTD_DB_PORT: '5434' });

  vi.spyOn(process, 'cwd').mockReturnValue(rootDir);
  process.env.ZTD_TEST_DATABASE_URL = 'postgres://ztd:ztd@127.0.0.1:5433/ztd';

  await expect(import('../templates/tests/support/setup-env')).rejects.toThrow(
    'ZTD_TEST_DATABASE_URL conflicts with the starter DB settings in .env'
  );
});

test('setup-env fails fast when a starter DB env var is missing', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-setup-env-missing-'));
  tempDirs.push(rootDir);
  writeStarterEnv(rootDir);
  rmSync(path.join(rootDir, '.env'));
  writeFileSync(
    path.join(rootDir, '.env'),
    [
      'ZTD_DB_HOST=127.0.0.1',
      'ZTD_DB_PORT=5433',
      'ZTD_DB_NAME=ztd',
      'ZTD_DB_USER=ztd'
    ].join('\n'),
    'utf8'
  );

  vi.spyOn(process, 'cwd').mockReturnValue(rootDir);
  delete process.env.ZTD_TEST_DATABASE_URL;

  await expect(import('../templates/tests/support/setup-env')).rejects.toThrow(
    'Set ZTD_DB_PASS in .env before running the starter DB-backed tests.'
  );
});
