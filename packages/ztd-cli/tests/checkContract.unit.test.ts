import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { formatOutput, runCheckContract } from '../src/commands/checkContract';

function createWorkspace(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'ztd-check-contract-'));
  mkdirSync(path.join(dir, 'src', 'catalog', 'specs'), { recursive: true });
  mkdirSync(path.join(dir, 'src', 'sql'), { recursive: true });
  return dir;
}

function writeFeatureLocalQuerySpec(root: string, featureName: string, sql: string): void {
  const queryDir = path.join(root, 'src', 'features', featureName, 'queries', 'list-users');
  mkdirSync(queryDir, { recursive: true });
  writeFileSync(path.join(queryDir, 'list-users.sql'), sql, 'utf8');
  writeFileSync(
    path.join(queryDir, 'queryspec.ts'),
    [
      "import { loadSqlResource } from '../../../_shared/loadSqlResource';",
      '',
      "const listUsersSql = loadSqlResource(__dirname, 'list-users.sql');",
      '',
      'export const listUsersQuerySpec = {',
      `  label: 'features.${featureName}.list-users',`,
      '  sql: listUsersSql',
      '};',
      ''
    ].join('\n'),
    'utf8'
  );
}

describe('runCheckContract', () => {
  test('detects duplicate spec ids', () => {
    const root = createWorkspace();
    writeFileSync(path.join(root, 'src', 'sql', 'a.sql'), 'SELECT 1', 'utf8');
    writeFileSync(path.join(root, 'src', 'catalog', 'specs', 'a.json'), JSON.stringify({ id: 'same', sqlFile: '../../sql/a.sql', params: { shape: 'positional', example: [] } }), 'utf8');
    writeFileSync(path.join(root, 'src', 'catalog', 'specs', 'b.json'), JSON.stringify({ id: 'same', sqlFile: '../../sql/a.sql', params: { shape: 'positional', example: [] } }), 'utf8');

    const result = runCheckContract({ strict: true, rootDir: root });
    expect(result.violations.some((v) => v.rule === 'duplicate-spec-id')).toBe(true);
  });

  test('detects unresolved sqlFile', () => {
    const root = createWorkspace();
    writeFileSync(path.join(root, 'src', 'catalog', 'specs', 'a.json'), JSON.stringify({ id: 'a', sqlFile: '../../sql/missing.sql', params: { shape: 'positional', example: [] } }), 'utf8');

    const result = runCheckContract({ strict: true, rootDir: root });
    expect(result.violations).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'unresolved-sql-file', specId: 'a' })]));
  });

  test('discovers feature-local QuerySpec assets project-wide by default', () => {
    const root = createWorkspace();
    writeFeatureLocalQuerySpec(root, 'users', 'SELECT id FROM users WHERE active = :active');

    const result = runCheckContract({ strict: true, rootDir: root });

    expect(result).toMatchObject({
      ok: true,
      filesChecked: 1,
      specsChecked: 1
    });
    expect(result.violations).toEqual([]);
  });

  test('limits project discovery with scopeDir and preserves legacy specsDir', () => {
    const root = createWorkspace();
    writeFeatureLocalQuerySpec(root, 'users', 'SELECT id FROM users WHERE active = :active');
    writeFeatureLocalQuerySpec(root, 'orders', 'SELECT * FROM orders');
    writeFileSync(path.join(root, 'src', 'sql', 'legacy.sql'), 'SELECT 1', 'utf8');
    writeFileSync(
      path.join(root, 'src', 'catalog', 'specs', 'legacy.json'),
      JSON.stringify({ id: 'legacy', sqlFile: '../../sql/legacy.sql', params: { shape: 'positional', example: [] } }),
      'utf8'
    );

    const scoped = runCheckContract({ strict: true, rootDir: root, scopeDir: path.join('src', 'features', 'users') });
    expect(scoped).toMatchObject({ filesChecked: 1, specsChecked: 1 });
    expect(scoped.violations.some((v) => v.specId === 'features.orders.list-users')).toBe(false);

    const legacy = runCheckContract({ strict: true, rootDir: root, specsDir: path.join('src', 'catalog', 'specs') });
    expect(legacy).toMatchObject({ filesChecked: 1, specsChecked: 1 });
    expect(legacy.violations.some((v) => v.specId === 'features.users.list-users')).toBe(false);
  });

  test('detects params shape mismatches', () => {
    const root = createWorkspace();
    writeFileSync(path.join(root, 'src', 'sql', 'a.sql'), 'SELECT 1', 'utf8');
    writeFileSync(path.join(root, 'src', 'catalog', 'specs', 'a.json'), JSON.stringify({ id: 'named-bad', sqlFile: '../../sql/a.sql', params: { shape: 'named', example: [] } }), 'utf8');
    writeFileSync(path.join(root, 'src', 'catalog', 'specs', 'b.json'), JSON.stringify({ id: 'pos-bad', sqlFile: '../../sql/a.sql', params: { shape: 'positional', example: { id: 1 } } }), 'utf8');

    const result = runCheckContract({ strict: true, rootDir: root });
    expect(result.violations.filter((v) => v.rule === 'params-shape-mismatch')).toHaveLength(2);
  });

  test('detects mapping duplicate/invalid entries', () => {
    const root = createWorkspace();
    writeFileSync(path.join(root, 'src', 'sql', 'a.sql'), 'SELECT 1', 'utf8');
    writeFileSync(path.join(root, 'src', 'catalog', 'specs', 'a.json'), JSON.stringify({ id: 'map', sqlFile: '../../sql/a.sql', params: { shape: 'positional', example: [] }, output: { mapping: { columnMap: { id: 'user_id', other: 'user_id', bad: '' } } } }), 'utf8');

    const result = runCheckContract({ strict: true, rootDir: root });
    expect(result.violations.some((v) => v.rule === 'mapping-duplicate-entry')).toBe(true);
    expect(result.violations.some((v) => v.rule === 'mapping-invalid-entry')).toBe(true);
  });

  test('warns when SQL assets are not covered by any QuerySpec', () => {
    const root = createWorkspace();
    writeFileSync(path.join(root, 'src', 'sql', 'orphan.sql'), 'SELECT 1', 'utf8');

    const result = runCheckContract({ strict: false, rootDir: root });
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: 'uncovered-sql-file',
          severity: 'warning'
        })
      ])
    );
  });

  test('safety checks are warnings by default and errors with strict', () => {
    const root = createWorkspace();
    writeFileSync(path.join(root, 'src', 'sql', 'unsafe.sql'), 'SELECT * FROM users; UPDATE users SET name = $1;', 'utf8');
    writeFileSync(path.join(root, 'src', 'catalog', 'specs', 'a.json'), JSON.stringify({ id: 'unsafe', sqlFile: '../../sql/unsafe.sql', params: { shape: 'positional', example: [] } }), 'utf8');

    const warnResult = runCheckContract({ strict: false, rootDir: root });
    expect(warnResult.ok).toBe(true);
    expect(warnResult.violations.some((v) => v.rule === 'safety-select-star' && v.severity === 'warning')).toBe(true);

    const strictResult = runCheckContract({ strict: true, rootDir: root });
    expect(strictResult.ok).toBe(false);
    expect(strictResult.violations.some((v) => v.rule === 'safety-missing-where' && v.severity === 'error')).toBe(true);
  });

  test('does not flag wildcard inside EXISTS subquery when root select list is explicit', () => {
    const root = createWorkspace();
    writeFileSync(
      path.join(root, 'src', 'sql', 'exists.sql'),
      'SELECT id FROM users WHERE EXISTS (SELECT * FROM orders WHERE orders.user_id = users.id);',
      'utf8'
    );
    writeFileSync(
      path.join(root, 'src', 'catalog', 'specs', 'exists.json'),
      JSON.stringify({ id: 'exists-safe', sqlFile: '../../sql/exists.sql', params: { shape: 'positional', example: [] } }),
      'utf8'
    );

    const result = runCheckContract({ strict: true, rootDir: root });
    expect(result.violations.some((v) => v.rule === 'safety-select-star')).toBe(false);
  });

  test('records sql parse warning for invalid SQL safety-check phase', () => {
    const root = createWorkspace();
    writeFileSync(path.join(root, 'src', 'sql', 'invalid.sql'), 'SELECT FROM', 'utf8');
    writeFileSync(
      path.join(root, 'src', 'catalog', 'specs', 'invalid.json'),
      JSON.stringify({ id: 'invalid.sql', sqlFile: '../../sql/invalid.sql', params: { shape: 'positional', example: [] } }),
      'utf8'
    );

    const result = runCheckContract({ strict: true, rootDir: root });
    expect(result.violations.some((v) => v.rule === 'sql-parse-error' && v.severity === 'warning')).toBe(true);
  });

  test('ts/js extractor includes mapping.prefix so mapping validation still runs', () => {
    const root = createWorkspace();
    writeFileSync(path.join(root, 'src', 'sql', 'prefix.sql'), 'SELECT 1', 'utf8');
    writeFileSync(
      path.join(root, 'src', 'catalog', 'specs', 'prefix.ts'),
      "export const bad = { id: 'prefix.bad', sqlFile: '../../sql/prefix.sql', params: { shape: 'positional', example: [] }, output: { mapping: { prefix: '' } } };",
      'utf8'
    );

    const result = runCheckContract({ strict: true, rootDir: root });
    expect(result.violations.some((v) => v.rule === 'mapping-invalid-entry')).toBe(true);
  });

  test('formatOutput emits deterministic json', () => {
    const formatted = formatOutput({ ok: false, filesChecked: 1, specsChecked: 1, violations: [{ rule: 'duplicate-spec-id', severity: 'error', specId: 'a', filePath: '/tmp/a.json', message: 'dup' }] }, 'json');
    expect(formatted).toContain('"rule": "duplicate-spec-id"');
  });
});
