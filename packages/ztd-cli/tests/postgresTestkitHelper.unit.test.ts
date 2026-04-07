import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

import {
  createStarterPostgresTestkitClient,
  loadStarterPostgresDefaults
} from '../templates/tests/support/postgres-testkit';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

test('loadStarterPostgresDefaults reads top-level starter defaults and falls back to public', () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-starter-defaults-'));
  tempDirs.push(rootDir);

  writeFileSync(
    path.join(rootDir, 'ztd.config.json'),
    JSON.stringify(
      {
        ztdRootDir: '.',
        defaultSchema: 'app',
        searchPath: ['app']
      },
      null,
      2
    ),
    'utf8'
  );

  expect(loadStarterPostgresDefaults(rootDir)).toEqual({
    projectRootDir: rootDir,
    defaultSchema: 'app',
    searchPath: ['app']
  });
});

test('loadStarterPostgresDefaults throws when ztd.config.json is malformed', () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-starter-config-error-'));
  tempDirs.push(rootDir);

  writeFileSync(path.join(rootDir, 'ztd.config.json'), '{ "defaultSchema": ', 'utf8');

  expect(() => loadStarterPostgresDefaults(rootDir)).toThrow(/Unexpected end of JSON input|malformed/);
});

test('createStarterPostgresTestkitClient requires an explicit connectionString or ZTD_DB_URL', () => {
  const previous = process.env.ZTD_DB_URL;
  delete process.env.ZTD_DB_URL;

  try {
    expect(() =>
      createStarterPostgresTestkitClient({
        tableDefinitions: [],
        tableRows: []
      })
    ).toThrow('Set options.connectionString or ZTD_DB_URL before creating a starter Postgres testkit client.');
  } finally {
    if (previous === undefined) {
      delete process.env.ZTD_DB_URL;
    } else {
      process.env.ZTD_DB_URL = previous;
    }
  }
});
