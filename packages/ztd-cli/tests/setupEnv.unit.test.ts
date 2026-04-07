import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

const DB_ENV_KEYS = ['ZTD_DB_HOST', 'ZTD_DB_PORT', 'ZTD_DB_NAME', 'ZTD_DB_USER', 'ZTD_DB_PASS'] as const;
const tempDirs: string[] = [];
const originalEnv = Object.fromEntries(
  [...DB_ENV_KEYS, 'ZTD_DB_URL'].map((key) => [key, process.env[key]])
) as Record<(typeof DB_ENV_KEYS)[number] | 'ZTD_DB_URL', string | undefined>;

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

test('setup-env derives ZTD_DB_URL from the starter DB env vars', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-setup-env-derived-'));
  tempDirs.push(rootDir);
  writeStarterEnv(rootDir);

  vi.spyOn(process, 'cwd').mockReturnValue(rootDir);
  for (const key of [...DB_ENV_KEYS, 'ZTD_DB_URL'] as const) {
    delete process.env[key];
  }

  await import('../templates/tests/support/setup-env');

  expect(process.env.ZTD_DB_URL).toBe('postgres://ztd:ztd@localhost:5433/ztd');
});

test('setup-env preserves an existing ZTD_DB_URL', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-setup-env-existing-'));
  tempDirs.push(rootDir);
  writeStarterEnv(rootDir, { ZTD_DB_PORT: '5434' });

  vi.spyOn(process, 'cwd').mockReturnValue(rootDir);
  for (const key of [...DB_ENV_KEYS, 'ZTD_DB_URL'] as const) {
    delete process.env[key];
  }
  process.env.ZTD_DB_URL = 'postgres://example:example@127.0.0.1:6000/example';

  await import('../templates/tests/support/setup-env');

  expect(process.env.ZTD_DB_URL).toBe('postgres://example:example@127.0.0.1:6000/example');
});

test('setup-env falls back to the default port when ZTD_DB_PORT is missing', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-setup-env-default-port-'));
  tempDirs.push(rootDir);
  writeStarterEnv(rootDir);
  writeFileSync(
    path.join(rootDir, '.env'),
    [
      'ZTD_DB_HOST=127.0.0.1',
      'ZTD_DB_NAME=ztd',
      'ZTD_DB_USER=ztd',
      'ZTD_DB_PASS=ztd'
    ].join('\n'),
    'utf8'
  );

  vi.spyOn(process, 'cwd').mockReturnValue(rootDir);
  for (const key of [...DB_ENV_KEYS, 'ZTD_DB_URL'] as const) {
    delete process.env[key];
  }

  await import('../templates/tests/support/setup-env');

  expect(process.env.ZTD_DB_URL).toBe('postgres://ztd:ztd@localhost:5432/ztd');
});
