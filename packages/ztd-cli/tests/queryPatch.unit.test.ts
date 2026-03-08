import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { applyQueryPatch } from '../src/query/patch';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function createSqlFile(rootDir: string, name: string, sql: string): string {
  const filePath = path.join(rootDir, name);
  writeFileSync(filePath, sql, 'utf8');
  return filePath;
}

function readNormalizedFile(filePath: string): string {
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

test('applyQueryPatch replaces only the targeted CTE while preserving metadata from the edited SQL', () => {
  const workspace = createTempDir('query-patch-apply');
  const originalFile = createSqlFile(
    workspace,
    'original.sql',
    `
      with users_base as (
        select id, region_id from public.users
      ),
      purchase_summary as (
        select id from users_base
      ),
      untouched_cte as (
        select * from public.audit_log
      )
      select * from purchase_summary
    `
  );
  const editedFile = createSqlFile(
    workspace,
    'edited.sql',
    `
      with users_base as (
        select id, region_id from public.users
      ),
      purchase_summary (user_id) as materialized (
        select id as user_id
        from users_base
        where region_id = 1
      )
      select * from purchase_summary
    `
  );
  const outputFile = path.join(workspace, 'patched.sql');

  const report = applyQueryPatch(originalFile, {
    cte: 'purchase_summary',
    from: editedFile,
    out: outputFile
  });

  expect(report.changed).toBe(true);
  expect(report.written).toBe(true);
  expect(report.output_file).toBe(outputFile);
  const patched = readNormalizedFile(outputFile);
  expect(patched).toContain('"purchase_summary"("user_id") as materialized');
  expect(patched).toContain('where "region_id" = 1');
  expect(patched).toContain('"untouched_cte" as');
  expect(patched).not.toContain('select "id" from "users_base"');
});

test('applyQueryPatch preview emits a unified diff without overwriting the original SQL file', () => {
  const workspace = createTempDir('query-patch-preview');
  const originalFile = createSqlFile(
    workspace,
    'original.sql',
    `
      with target_cte as (
        select id from public.users
      )
      select * from target_cte
    `
  );
  const editedFile = createSqlFile(
    workspace,
    'edited.sql',
    'target_cte as (select id from public.users where active = true)'
  );
  const before = readNormalizedFile(originalFile);

  const report = applyQueryPatch(originalFile, {
    cte: 'target_cte',
    from: editedFile,
    preview: true
  });

  expect(report.preview).toBe(true);
  expect(report.written).toBe(false);
  expect(report.diff).toContain('--- ');
  expect(report.diff).toContain('+++ ');
  expect(report.diff).toContain('"active" = true');
  expect(readNormalizedFile(originalFile)).toBe(before);
});

test('applyQueryPatch fails when the edited SQL does not contain the requested CTE', () => {
  const workspace = createTempDir('query-patch-missing-target');
  const originalFile = createSqlFile(
    workspace,
    'original.sql',
    `
      with target_cte as (
        select id from public.users
      )
      select * from target_cte
    `
  );
  const editedFile = createSqlFile(
    workspace,
    'edited.sql',
    `
      with other_cte as (
        select id from public.users
      )
      select * from other_cte
    `
  );

  expect(() => applyQueryPatch(originalFile, {
    cte: 'target_cte',
    from: editedFile
  })).toThrow(`CTE "target_cte" was not found in ${editedFile}.`);
});

