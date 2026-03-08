import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { buildQueryStructureReport } from '../src/query/structure';

function createSqlFile(prefix: string, sql: string): string {
  const workspace = mkdtempSync(path.join(tmpdir(), `${prefix}-`));
  const sqlFile = path.join(workspace, 'query.sql');
  writeFileSync(sqlFile, sql, 'utf8');
  return sqlFile;
}

test('buildQueryStructureReport reports the caller command name on unsupported input', () => {
  const sqlFile = createSqlFile(
    'query-graph-unsupported',
    'create table public.users (id integer primary key)'
  );

  expect(() => buildQueryStructureReport(sqlFile, 'ztd query graph')).toThrow(
    'ztd query graph supports SELECT/INSERT/UPDATE/DELETE statements only.'
  );
});
