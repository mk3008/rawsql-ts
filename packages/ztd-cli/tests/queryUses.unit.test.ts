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
  expect(() => parseQueryTarget({ kind: 'table', raw: 'public.users', anySchema: true, anyTable: true })).toThrow(/not supported for table usage/);
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

test('impact view aggregates table usage by statement', () => {
  const root = createWorkspace('query-uses-table-impact');
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

  expect(report.schemaVersion).toBe(2);
  expect(report.view).toBe('impact');
  expect(report.summary).toMatchObject({
    catalogsScanned: 1,
    statementsScanned: 7,
    matches: 7,
    fallbackMatches: 0,
    parseWarnings: 0
  });
  expect(report.matches.every((match) => match.kind === 'impact')).toBe(true);
  expect(report.matches.map((match) => ({
    queryId: match.query_id,
    usageKinds: match.kind === 'impact' ? match.usageKindCounts : {},
    confidence: match.confidence,
    notes: match.notes
  }))).toEqual([
    { queryId: 'catalog.users:1', usageKinds: { from: 1 }, confidence: 'high', notes: [] },
    { queryId: 'catalog.users:2', usageKinds: { join: 1 }, confidence: 'high', notes: [] },
    { queryId: 'catalog.users:3', usageKinds: { 'update-target': 1 }, confidence: 'high', notes: [] },
    { queryId: 'catalog.users:4', usageKinds: { 'delete-target': 1 }, confidence: 'high', notes: [] },
    { queryId: 'catalog.users:5', usageKinds: { 'insert-target': 1 }, confidence: 'high', notes: [] },
    { queryId: 'catalog.users:6', usageKinds: { 'subquery-from': 1 }, confidence: 'high', notes: [] },
    { queryId: 'catalog.users:7', usageKinds: { 'cte-body-from': 1 }, confidence: 'high', notes: [] }
  ]);
  expect(formatQueryUsageReport(report, 'json')).toContain('"view": "impact"');
  expect(formatQueryUsageReport(report, 'text')).toContain('Affected queries:');
});

test('impact view keeps high confidence for exact table matches with quoted identifiers', () => {
  const root = createWorkspace('query-uses-table-quoted');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'sql', 'users.sql'),
    'SELECT * FROM "public"."users";\nSELECT * FROM public . users;',
    'utf8'
  );

  const report = buildQueryUsageReport({
    kind: 'table',
    rawTarget: 'public.users',
    rootDir: root
  });

  expect(report.matches).toEqual([
    expect.objectContaining({
      kind: 'impact',
      query_id: 'catalog.users:1',
      confidence: 'high',
      notes: [],
      usageKindCounts: { from: 1 }
    }),
    expect.objectContaining({
      kind: 'impact',
      query_id: 'catalog.users:2',
      confidence: 'high',
      notes: [],
      usageKindCounts: { from: 1 }
    })
  ]);
});

test('detail view keeps per-occurrence rows and fixes clause-aware column locations', () => {
  const root = createWorkspace('query-uses-column-detail');
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
      'UPDATE public.users SET email = $1 RETURNING email;',
      'INSERT INTO public.users (email) VALUES ($1);'
    ].join('\n'),
    'utf8'
  );

  const report = buildQueryUsageReport({
    kind: 'column',
    rawTarget: 'public.users.email',
    rootDir: root,
    view: 'detail'
  });

  expect(report.view).toBe('detail');
  expect(report.matches.every((match) => match.kind === 'detail')).toBe(true);

  const orderBy = report.matches.find((match) => match.kind === 'detail' && match.usage_kind === 'order-by');
  const where = report.matches.find((match) => match.kind === 'detail' && match.usage_kind === 'where');
  const returning = report.matches.find((match) => match.kind === 'detail' && match.usage_kind === 'returning');
  const updateSet = report.matches.find((match) => match.kind === 'detail' && match.usage_kind === 'update-set');

  expect(where?.snippet).toBe('WHERE email = $1');
  expect(orderBy?.snippet).toBe('ORDER BY email');
  expect(where?.location?.fileOffsetStart).toBeLessThan(orderBy?.location?.fileOffsetStart ?? 0);
  expect(returning?.snippet).toBe('RETURNING email');
  expect(updateSet?.snippet).toBe('SET email = $1');
  expect((returning?.location?.fileOffsetStart ?? 0)).toBeGreaterThan(updateSet?.location?.fileOffsetStart ?? 0);
  expect(formatQueryUsageReport(report, 'text')).toContain('Primary matches:');
});

test('detail view unwraps nested paren sources when collecting subquery column usage', () => {
  const root = createWorkspace('query-uses-column-nested-paren-source');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'sql', 'users.sql'),
    'SELECT nested.email FROM ((SELECT email FROM public.users) ) nested;',
    'utf8'
  );

  const report = buildQueryUsageReport({
    kind: 'column',
    rawTarget: 'public.users.email',
    rootDir: root,
    view: 'detail'
  });

  expect(report.matches).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'detail',
      usage_kind: 'subquery'
    })
  ]));
});

test('impact view aggregates confidence and notes for relaxed column investigation', () => {
  const root = createWorkspace('query-uses-relaxed-impact');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(root, 'src', 'sql', 'users.sql'), 'SELECT email FROM public.users ORDER BY email;', 'utf8');

  const report = buildQueryUsageReport({
    kind: 'column',
    rawTarget: 'email',
    rootDir: root,
    anySchema: true,
    anyTable: true
  });

  expect(report.mode).toBe('any-schema-any-table');
  expect(report.target).toEqual({
    kind: 'column',
    raw: 'email',
    column: 'email'
  });
  const match = report.matches[0];
  expect(match?.kind).toBe('impact');
  if (match?.kind === 'impact') {
    expect(match.confidence).toBe('low');
    expect(match.notes).toEqual(expect.arrayContaining([
      'relaxed-match-any-schema',
      'relaxed-match-any-table',
      'statement-has-unqualified-column'
    ]));
    expect(match.usageKindCounts).toEqual({ 'order-by': 1, select: 1 });
    expect(match.representatives?.map((representative) => representative.usage_kind)).toEqual(['order-by']);
  }
});

test('impact view keeps select counts but omits select representatives', () => {
  const root = createWorkspace('query-uses-impact-select-representatives');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'sql', 'users.sql'),
    'SELECT email FROM public.users WHERE email = $1 ORDER BY email;',
    'utf8'
  );

  const report = buildQueryUsageReport({
    kind: 'column',
    rawTarget: 'public.users.email',
    rootDir: root
  });

  const match = report.matches[0];
  expect(match?.kind).toBe('impact');
  if (match?.kind === 'impact') {
    expect(match.usageKindCounts).toEqual({ 'order-by': 1, select: 1, where: 1 });
    expect(match.representatives?.map((representative) => representative.usage_kind)).toEqual(['order-by', 'where']);
  }
});

test('detail view emits parse warnings, fallback rows, and no-catalog guidance deterministically', () => {
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
    rootDir: root,
    view: 'detail'
  });

  expect(tableReport.summary).toMatchObject({
    parseWarnings: 1,
    unresolvedSqlFiles: 1,
    fallbackMatches: 1
  });
  expect(tableReport.matches).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'detail',
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

  const emptyRoot = createWorkspace('query-uses-empty');
  const emptyReport = buildQueryUsageReport({
    kind: 'table',
    rawTarget: 'public.users',
    rootDir: emptyRoot
  });
  expect(emptyReport.summary.matches).toBe(0);
  expect(emptyReport.warnings).toEqual([
    {
      code: 'no-catalog-specs-found',
      message: expect.stringContaining('Hint: run "ztd init" or pass "--specs-dir".')
    }
  ]);
  expect(formatQueryUsageReport(emptyReport, 'text')).toContain('No catalog specs found under');
});

test('query usage report isolates spec load failures per file', () => {
  const root = createWorkspace('query-uses-spec-load-failure');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'broken.spec.json'),
    '{',
    'utf8'
  );
  writeFileSync(path.join(root, 'src', 'sql', 'users.sql'), 'SELECT * FROM public.users;', 'utf8');

  const report = buildQueryUsageReport({
    kind: 'table',
    rawTarget: 'public.users',
    rootDir: root
  });

  expect(report.summary.matches).toBe(1);
  expect(report.warnings).toEqual(expect.arrayContaining([
    expect.objectContaining({
      code: 'spec-load-failed',
      sql_file: 'src/catalog/specs/broken.spec.json'
    })
  ]));
});
