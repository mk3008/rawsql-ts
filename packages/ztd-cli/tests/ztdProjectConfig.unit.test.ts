import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

async function loadConfigModule() {
  vi.resetModules();
  return import('../src/utils/ztdProjectConfig');
}

test('writeZtdProjectConfig skips rewriting when the effective config is unchanged', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-config-write-noop-'));
  tempDirs.push(rootDir);

  writeFileSync(
    path.join(rootDir, 'ztd.config.json'),
    JSON.stringify(
      {
        dialect: 'postgres',
        ddlDir: 'ztd/ddl',
        testsDir: 'tests',
        defaultSchema: 'public',
        searchPath: ['public'],
        ddl: { defaultSchema: 'public', searchPath: ['public'] },
        ddlLint: 'strict'
      },
      null,
      2
    ),
    'utf8'
  );

  const { loadZtdProjectConfig, writeZtdProjectConfig } = await loadConfigModule();
  const config = loadZtdProjectConfig(rootDir);
  const beforeContents = readFileSync(path.join(rootDir, 'ztd.config.json'), 'utf8');
  const beforeStat = statSync(path.join(rootDir, 'ztd.config.json'));

  const didWrite = writeZtdProjectConfig(rootDir, {}, config);

  expect(didWrite).toBe(false);
  expect(config.defaultSchema).toBe('public');
  expect(config.searchPath).toEqual(['public']);
  expect(readFileSync(path.join(rootDir, 'ztd.config.json'), 'utf8')).toBe(beforeContents);
  expect(statSync(path.join(rootDir, 'ztd.config.json')).mtimeMs).toBe(beforeStat.mtimeMs);
});

test('loadZtdProjectConfig warns when legacy connection config is present', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-config-legacy-'));
  tempDirs.push(rootDir);

  writeFileSync(
    path.join(rootDir, 'ztd.config.json'),
    JSON.stringify(
      {
        dialect: 'postgres',
        ddlDir: 'ztd/ddl',
        testsDir: 'tests',
        defaultSchema: 'public',
        searchPath: ['public'],
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
  const { loadZtdProjectConfig } = await loadConfigModule();

  const config = loadZtdProjectConfig(rootDir);

  expect(config.connection).toMatchObject({
    host: 'legacy-db',
    user: 'legacy-user',
    database: 'legacy-db'
  });
  expect(config.defaultSchema).toBe('public');
  expect(config.searchPath).toEqual(['public']);
  expect(emitWarning).toHaveBeenCalledTimes(1);
  expect(emitWarning.mock.calls[0]?.[0]).toContain('ztd.config.json.connection');
  expect(emitWarning.mock.calls[0]?.[1]).toMatchObject({ code: 'ZTD_LEGACY_CONNECTION_CONFIG' });
});

test('loadZtdProjectConfig does not warn when legacy connection config is absent', async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'ztd-config-modern-'));
  tempDirs.push(rootDir);

  writeFileSync(
    path.join(rootDir, 'ztd.config.json'),
    JSON.stringify(
      {
        dialect: 'postgres',
        ddlDir: 'ztd/ddl',
        testsDir: 'tests',
        defaultSchema: 'public',
        searchPath: ['public'],
        ddl: { defaultSchema: 'public', searchPath: ['public'] },
        ddlLint: 'strict'
      },
      null,
      2
    ),
    'utf8'
  );

  const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
  const { loadZtdProjectConfig } = await loadConfigModule();

  const config = loadZtdProjectConfig(rootDir);

  expect(config.connection).toBeUndefined();
  expect(config.defaultSchema).toBe('public');
  expect(config.searchPath).toEqual(['public']);
  expect(emitWarning).not.toHaveBeenCalled();
});
