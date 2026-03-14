import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { loadZtdProjectConfig } from '../src/utils/ztdProjectConfig';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

test('loadZtdProjectConfig warns when legacy connection config is present', () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-config-legacy-'));
  tempDirs.push(rootDir);

  writeFileSync(
    path.join(rootDir, 'ztd.config.json'),
    JSON.stringify(
      {
        dialect: 'postgres',
        ddlDir: 'ztd/ddl',
        testsDir: 'tests',
        ddl: { defaultSchema: 'public', searchPath: ['public'] },
        ddlLint: 'strict',
        connection: {
          host: 'legacy-db',
          user: 'legacy-user',
          database: 'legacy-db'
        }
      },
      null,
      2
    ),
    'utf8'
  );

  const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);

  const config = loadZtdProjectConfig(rootDir);

  expect(config.connection).toMatchObject({
    host: 'legacy-db',
    user: 'legacy-user',
    database: 'legacy-db'
  });
  expect(emitWarning).toHaveBeenCalledTimes(1);
  expect(emitWarning.mock.calls[0]?.[0]).toContain('ztd.config.json.connection');
});

test('loadZtdProjectConfig does not warn when legacy connection config is absent', () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-config-modern-'));
  tempDirs.push(rootDir);

  writeFileSync(
    path.join(rootDir, 'ztd.config.json'),
    JSON.stringify(
      {
        dialect: 'postgres',
        ddlDir: 'ztd/ddl',
        testsDir: 'tests',
        ddl: { defaultSchema: 'public', searchPath: ['public'] },
        ddlLint: 'strict'
      },
      null,
      2
    ),
    'utf8'
  );

  const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);

  const config = loadZtdProjectConfig(rootDir);

  expect(config.connection).toBeUndefined();
  expect(emitWarning).not.toHaveBeenCalled();
});
