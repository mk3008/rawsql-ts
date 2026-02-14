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

  test('formatOutput emits deterministic json', () => {
    const formatted = formatOutput({ ok: false, filesChecked: 1, specsChecked: 1, violations: [{ rule: 'duplicate-spec-id', severity: 'error', specId: 'a', filePath: '/tmp/a.json', message: 'dup' }] }, 'json');
    expect(formatted).toContain('"rule": "duplicate-spec-id"');
  });
});
