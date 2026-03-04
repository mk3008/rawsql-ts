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

test('impact view resolves sql-root-relative sqlFile values before the legacy spec-relative fallback', () => {
  const root = createWorkspace('query-uses-sql-root-relative');
  mkdirSync(path.join(root, 'src', 'sql', 'sales'), { recursive: true });
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'sales.spec.ts'),
    [
      'export const salesSpec = {',
      "  id: 'sales.byId',",
      "  sqlFile: 'sales/get-sale-by-id.sql',",
      "  params: { shape: 'named', example: { sale_id: 'sale-001' } }",
      '};'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'sql', 'sales', 'get-sale-by-id.sql'),
    'SELECT p.name FROM public.sales s LEFT JOIN public.products p ON p.id = s.sale_id;',
    'utf8'
  );

  const report = buildQueryUsageReport({
    kind: 'table',
    rawTarget: 'public.products',
    rootDir: root
  });

  expect(report.summary).toMatchObject({
    catalogsScanned: 1,
    statementsScanned: 1,
    matches: 1,
    unresolvedSqlFiles: 0
  });
  expect(report.matches).toEqual([
    expect.objectContaining({
      kind: 'impact',
      catalog_id: 'sales.byId',
      query_id: 'sales.byId:1',
      sql_file: 'src/sql/sales/get-sale-by-id.sql',
      usageKindCounts: { join: 1 }
    })
  ]);
  expect(report.warnings).toEqual([]);
  expect(formatQueryUsageReport(report, 'text')).toContain('unresolved sql files: 0');
});

test('query usage report defaults to impact view unless detail is requested explicitly', () => {
  const root = createWorkspace('query-uses-default-impact');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(root, 'src', 'sql', 'users.sql'), 'SELECT email FROM public.users;', 'utf8');

  const defaultReport = buildQueryUsageReport({
    kind: 'column',
    rawTarget: 'public.users.email',
    rootDir: root
  });
  const explicitImpactReport = buildQueryUsageReport({
    kind: 'column',
    rawTarget: 'public.users.email',
    rootDir: root,
    view: 'impact'
  });
  const detailReport = buildQueryUsageReport({
    kind: 'column',
    rawTarget: 'public.users.email',
    rootDir: root,
    view: 'detail'
  });

  expect(defaultReport.view).toBe('impact');
  expect(defaultReport.matches.every((match) => match.kind === 'impact')).toBe(true);
  expect(explicitImpactReport).toEqual(defaultReport);
  expect(detailReport.view).toBe('detail');
  expect(detailReport.matches.every((match) => match.kind === 'detail')).toBe(true);
});

test('query usage report can exclude generated specs while keeping the default scan set unchanged', () => {
  const root = createWorkspace('query-uses-exclude-generated');
  mkdirSync(path.join(root, 'src', 'catalog', 'specs', 'generated'), { recursive: true });
  mkdirSync(path.join(root, 'src', 'sql', 'sales'), { recursive: true });
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'sales.spec.ts'),
    [
      'export const salesSpec = {',
      "  id: 'sales.byId',",
      "  sqlFile: 'sales/get-sale-by-id.sql',",
      "  params: { shape: 'named', example: { sale_id: 'sale-001' } }",
      '};'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'generated', 'sales.generated.spec.ts'),
    [
      'export const generatedSalesSpec = {',
      "  id: 'sales.generatedById',",
      "  sqlFile: 'sales/get-sale-by-id.sql',",
      "  params: { shape: 'named', example: { sale_id: 'sale-001' } }",
      '};'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'sql', 'sales', 'get-sale-by-id.sql'),
    'SELECT p.name FROM public.sales s LEFT JOIN public.products p ON p.id = s.sale_id;',
    'utf8'
  );

  const includedReport = buildQueryUsageReport({
    kind: 'table',
    rawTarget: 'public.products',
    rootDir: root
  });
  const excludedReport = buildQueryUsageReport({
    kind: 'table',
    rawTarget: 'public.products',
    rootDir: root,
    excludeGenerated: true
  });

  expect(includedReport.summary).toMatchObject({
    catalogsScanned: 2,
    matches: 2,
    unresolvedSqlFiles: 0
  });
  expect(includedReport.matches.map((match) => match.catalog_id)).toEqual([
    'sales.byId',
    'sales.generatedById'
  ]);
  expect(excludedReport.summary).toMatchObject({
    catalogsScanned: 1,
    matches: 1,
    unresolvedSqlFiles: 0
  });
  expect(excludedReport.matches.map((match) => match.catalog_id)).toEqual(['sales.byId']);
});

test('table impact ignores RETURNING-only statements when the target table is never referenced', () => {
  const root = createWorkspace('query-uses-table-ignore-returning');
  mkdirSync(path.join(root, 'src', 'sql', 'sales'), { recursive: true });
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'sales.spec.ts'),
    [
      'export const salesSpec = {',
      "  id: 'sales.mutations',",
      "  sqlFile: 'sales/mutations.sql',",
      "  params: { shape: 'named', example: { sale_id: 'sale-001' } }",
      '};'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'sql', 'sales', 'mutations.sql'),
    [
      'insert into public.sales (id) values (:sale_id) returning id;',
      'update public.sales set id = :sale_id where id = :sale_id returning id;',
      'delete from public.sales where id = :sale_id returning id;'
    ].join('\n'),
    'utf8'
  );

  const report = buildQueryUsageReport({
    kind: 'table',
    rawTarget: 'public.sale_discounts',
    rootDir: root
  });

  expect(report.summary).toMatchObject({
    statementsScanned: 3,
    matches: 0,
    unresolvedSqlFiles: 0
  });
  expect(report.matches).toEqual([]);
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
      message: expect.stringContaining('SQL file does not exist: ../../sql/missing.sql'),
      sql_file: 'sql/missing.sql'
    }
  ]);
  expect(tableReport.warnings[1]?.message).toContain('Tried project SQL root (src/sql): sql/missing.sql');
  expect(tableReport.warnings[1]?.message).toContain('Tried spec-relative fallback: src/sql/missing.sql');
  expect(tableReport.warnings[1]?.message).toContain('re-run with --sql-root src/sql');
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

test('table impact finds tables referenced from EXISTS subqueries through their FROM nodes', () => {
  const root = createWorkspace('query-uses-table-exists-subquery');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'sales.spec.json'),
    JSON.stringify({ id: 'catalog.sales', sqlFile: '../../sql/sales.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'sql', 'sales.sql'),
    [
      'SELECT s.id',
      'FROM public.sales s',
      'WHERE EXISTS (',
      '  SELECT 1',
      '  FROM public.sale_items si',
      '  WHERE si.sale_id = s.id',
      ');'
    ].join('\n'),
    'utf8'
  );

  const report = buildQueryUsageReport({
    kind: 'table',
    rawTarget: 'public.sale_items',
    rootDir: root,
    view: 'detail'
  });

  expect(report.summary).toMatchObject({
    matches: 1,
    unresolvedSqlFiles: 0
  });
  expect(report.matches).toEqual([
    expect.objectContaining({
      kind: 'detail',
      catalog_id: 'catalog.sales',
      usage_kind: 'subquery-from',
      sql_file: 'src/sql/sales.sql'
    })
  ]);
});

test('impact view still resolves legacy spec-relative sqlFile values for backward compatibility', () => {
  const root = createWorkspace('query-uses-spec-relative-fallback');
  mkdirSync(path.join(root, 'spec-assets'), { recursive: true });
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../../spec-assets/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(root, 'spec-assets', 'users.sql'), 'SELECT * FROM public.users;', 'utf8');

  const report = buildQueryUsageReport({
    kind: 'table',
    rawTarget: 'public.users',
    rootDir: root
  });

  expect(report.summary).toMatchObject({
    matches: 1,
    unresolvedSqlFiles: 0
  });
  expect(report.matches).toEqual([
    expect.objectContaining({
      kind: 'impact',
      catalog_id: 'catalog.users',
      sql_file: 'spec-assets/users.sql',
      usageKindCounts: { from: 1 }
    })
  ]);
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
