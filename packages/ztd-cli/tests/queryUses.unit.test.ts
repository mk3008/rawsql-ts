import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { formatQueryUsageReport } from '../src/query/format';
import { buildQueryUsageReport } from '../src/query/report';
import { parseQueryTarget } from '../src/query/targets';

function createWorkspace(prefix: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  mkdirSync(path.join(root, 'src', 'catalog', 'specs'), { recursive: true });
  mkdirSync(path.join(root, 'src', 'sql'), { recursive: true });
  return root;
}

test('parseQueryTarget enforces strict defaults and explicit relaxed modes', () => {
  expect(() => parseQueryTarget({ kind: 'table', raw: 'users' })).toThrow(/schema\.table/);
  expect(() => parseQueryTarget({ kind: 'column', raw: 'users.email' })).toThrow(/schema\.table\.column/);
  expect(() => parseQueryTarget({ kind: 'column', raw: 'email', anyTable: true })).toThrow(/requires --any-schema/);

  expect(parseQueryTarget({ kind: 'column', raw: 'public.users.email' })).toEqual({
    mode: 'exact',
    target: { kind: 'column', raw: 'public.users.email', schema: 'public', table: 'users', column: 'email' }
  });
  expect(parseQueryTarget({ kind: 'column', raw: 'users.email', anySchema: true })).toEqual({
    mode: 'any-schema',
    target: { kind: 'column', raw: 'users.email', table: 'users', column: 'email' }
  });
  expect(parseQueryTarget({ kind: 'column', raw: 'email', anySchema: true, anyTable: true })).toEqual({
    mode: 'any-schema-any-table',
    target: { kind: 'column', raw: 'email', column: 'email' }
  });
});

test('buildQueryUsageReport finds exact table usage with deterministic ordering and locations', () => {
  const root = createWorkspace('query-uses-table');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'sql', 'users.sql'),
    [
      'SELECT u.email FROM public.users u;',
      'SELECT o.id FROM public.orders o JOIN public.users u ON u.id = o.user_id;',
      'UPDATE public.users SET email = $1 WHERE id = $2;',
      'DELETE FROM public.users WHERE id = $1;',
      'INSERT INTO public.users (email) VALUES ($1);',
      'SELECT * FROM (SELECT id FROM public.users) nested;',
      'WITH active_users AS (SELECT id FROM public.users) SELECT id FROM active_users;'
    ].join('\n'),
    'utf8'
  );

  const report = buildQueryUsageReport({
    kind: 'table',
    rawTarget: 'public.users',
    rootDir: root
  });

  expect(report.mode).toBe('exact');
  expect(report.summary).toMatchObject({
    catalogsScanned: 1,
    statementsScanned: 7,
    matches: 7,
    fallbackMatches: 0,
    parseWarnings: 0
  });
  expect(report.matches.map((match) => ({
    queryId: match.query_id,
    usageKind: match.usage_kind,
    offset: match.location?.fileOffsetStart,
    snippet: match.snippet
  }))).toEqual([
    { queryId: 'catalog.users:1', usageKind: 'from', offset: 20, snippet: 'SELECT u.email FROM public.users u' },
    { queryId: 'catalog.users:2', usageKind: 'join', offset: 73, snippet: 'SELECT o.id FROM public.orders o JOIN public.users u ON u.id = o.user_id' },
    { queryId: 'catalog.users:3', usageKind: 'update-target', offset: 116, snippet: 'UPDATE public.users SET email = $1 WHERE id = $2' },
    { queryId: 'catalog.users:4', usageKind: 'delete-target', offset: 171, snippet: 'DELETE FROM public.users WHERE id = $1' },
    { queryId: 'catalog.users:5', usageKind: 'insert-target', offset: 211, snippet: 'INSERT INTO public.users (email) VALUES ($1)' },
    { queryId: 'catalog.users:6', usageKind: 'subquery-from', offset: 275, snippet: 'SELECT * FROM (SELECT id FROM public.users) nested' },
    { queryId: 'catalog.users:7', usageKind: 'cte-body-from', offset: 334, snippet: 'WITH active_users AS (SELECT id FROM public.users) SELECT id FROM active_users' }
  ]);

  expect(formatQueryUsageReport(report, 'json')).toContain('"mode": "exact"');
  expect(formatQueryUsageReport(report, 'text')).toContain('Primary matches:');
});

test('buildQueryUsageReport finds exact column usage and labels uncertainty explicitly', () => {
  const root = createWorkspace('query-uses-column');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'sql', 'users.sql'),
    [
      'SELECT u.email FROM public.users u;',
      'SELECT id FROM public.users WHERE email = $1 ORDER BY email;',
      'SELECT u.id FROM public.users u JOIN public.orders o ON u.email = o.email;',
      'SELECT u.id FROM public.users u JOIN public.orders o USING (email);',
      'SELECT * FROM public.users;',
      'WITH user_cte AS (SELECT email FROM public.users) SELECT email FROM user_cte;',
      'SELECT email FROM (SELECT email FROM public.users) nested;',
      'UPDATE public.users SET email = $1 RETURNING email;',
      'INSERT INTO public.users (email) VALUES ($1);'
    ].join('\n'),
    'utf8'
  );

  const report = buildQueryUsageReport({
    kind: 'column',
    rawTarget: 'public.users.email',
    rootDir: root
  });

  expect(report.mode).toBe('exact');
  expect(report.summary).toMatchObject({
    catalogsScanned: 1,
    statementsScanned: 9,
    matches: 11
  });
  expect(report.matches.map((match) => ({
    usageKind: match.usage_kind,
    confidence: match.confidence,
    notes: match.notes
  }))).toEqual(expect.arrayContaining([
    expect.objectContaining({ usageKind: 'select', confidence: 'high', notes: [] }),
    expect.objectContaining({ usageKind: 'where', confidence: 'low', notes: expect.arrayContaining(['unqualified-column']) }),
    expect.objectContaining({ usageKind: 'join-on', confidence: 'high', notes: [] }),
    expect.objectContaining({ usageKind: 'join-using', confidence: 'low', notes: expect.arrayContaining(['join-using-column', 'unqualified-column']) }),
    expect.objectContaining({ usageKind: 'select', confidence: 'low', notes: expect.arrayContaining(['wildcard-select']) }),
    expect.objectContaining({ usageKind: 'cte', confidence: 'low', notes: expect.arrayContaining(['cte-projection', 'unqualified-column']) }),
    expect.objectContaining({ usageKind: 'subquery', confidence: 'low', notes: expect.arrayContaining(['subquery-projection', 'unqualified-column']) }),
    expect.objectContaining({ usageKind: 'update-set', confidence: 'low', notes: expect.arrayContaining(['ambiguous-multiple-occurrences']) }),
    expect.objectContaining({ usageKind: 'returning', confidence: 'low' }),
    expect.objectContaining({ usageKind: 'insert-column', confidence: 'high', notes: [] })
  ]));
  expect(formatQueryUsageReport(report, 'json')).toContain('"statement_fingerprint"');
});

test('buildQueryUsageReport requires explicit relaxed mode and includes relaxed notes', () => {
  const root = createWorkspace('query-uses-relaxed');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(root, 'src', 'sql', 'users.sql'), 'SELECT email FROM public.users;', 'utf8');

  const report = buildQueryUsageReport({
    kind: 'column',
    rawTarget: 'users.email',
    rootDir: root,
    anySchema: true
  });

  expect(report.mode).toBe('any-schema');
  expect(report.target).toEqual({
    kind: 'column',
    raw: 'users.email',
    table: 'users',
    column: 'email'
  });
  expect(report.matches[0]?.confidence).toBe('low');
  expect(report.matches[0]?.notes).toContain('relaxed-match-any-schema');
});

test('buildQueryUsageReport emits parse warnings, unresolved sql warnings, and table-only fallback deterministically', () => {
  const root = createWorkspace('query-uses-warnings');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'a.spec.json'),
    JSON.stringify({ id: 'catalog.a', sqlFile: '../../sql/a.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'b.spec.json'),
    JSON.stringify({ id: 'catalog.b', sqlFile: '../../sql/missing.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(root, 'src', 'sql', 'a.sql'), 'UPDATE public.users SET email =', 'utf8');

  const tableReport = buildQueryUsageReport({
    kind: 'table',
    rawTarget: 'public.users',
    rootDir: root
  });

  expect(tableReport.summary).toMatchObject({
    parseWarnings: 1,
    unresolvedSqlFiles: 1,
    fallbackMatches: 1
  });
  expect(tableReport.matches).toEqual(expect.arrayContaining([
    expect.objectContaining({
      source: 'fallback',
      usage_kind: 'update-target',
      confidence: 'low',
      notes: expect.arrayContaining(['parser-fallback'])
    })
  ]));
  expect(tableReport.warnings).toEqual([
    {
      catalog_id: 'catalog.a',
      code: 'parse-failed',
      message: expect.any(String),
      query_id: 'catalog.a:1',
      sql_file: 'src/sql/a.sql'
    },
    {
      catalog_id: 'catalog.b',
      code: 'unresolved-sql-file',
      message: 'SQL file does not exist: ../../sql/missing.sql',
      sql_file: 'src/sql/missing.sql'
    }
  ]);
  expect(formatQueryUsageReport(tableReport, 'text')).toContain('Fallback-derived matches:');

  const columnReport = buildQueryUsageReport({
    kind: 'column',
    rawTarget: 'public.users.email',
    rootDir: root
  });
  expect(columnReport.summary.fallbackMatches).toBe(0);
  expect(columnReport.matches).toHaveLength(0);
});
