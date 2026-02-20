import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  formatTestEvidenceOutput,
  runTestEvidenceSpecification,
  TestEvidenceRuntimeError
} from '../src/commands/testEvidence';

function createWorkspace(prefix: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  mkdirSync(path.join(root, 'src', 'catalog', 'specs'), { recursive: true });
  mkdirSync(path.join(root, 'src', 'sql'), { recursive: true });
  mkdirSync(path.join(root, 'tests', 'specs'), { recursive: true });
  return root;
}

function writeSpecModule(root: string, options?: { testCaseIds?: string[]; includeSqlCase?: boolean }): void {
  const testCaseIds = options?.testCaseIds ?? ['returns-active-users', 'skipped-case'];
  const sqlCaseBlock = options?.includeSqlCase === false
    ? 'sqlCatalogCases: [],'
    : [
      'sqlCatalogCases: [',
      '  {',
      "    id: 'sql.active-orders',",
      "    title: 'active orders',",
      '    fixtures: [',
      "      { tableName: 'users', rows: [{ id: 1 }], schema: { columns: { id: 'INTEGER' } } }",
      '    ],',
      '    catalog: {',
      "      id: 'orders.active-users.list',",
      "      params: { shape: 'named', example: { active: 1, minTotal: 20, limit: 2 } },",
      "      output: { mapping: { columnMap: { orderId: 'order_id' } } },",
      "      sql: 'select order_id from orders where active = @active'",
      '    },',
      '    cases: [',
      "      { id: 'baseline', title: 'baseline', expected: [{ orderId: 10 }] },",
      "      { id: 'inactive', title: 'inactive', arrange: () => ({ active: 0 }), expected: [{ orderId: 12 }] }",
      '    ]',
      '  }',
      '],'
    ].join('\n');

  const source = [
    'module.exports = {',
    'testCaseCatalogs: [',
    '  {',
    "    id: 'unit.users',",
    "    title: 'User behavior',",
    '    cases: [',
    ...testCaseIds.map((id) => `      { id: '${id}', title: '${id.replace(/-/g, ' ')}' },`),
    '    ]',
    '  }',
    '],',
    sqlCaseBlock,
    '};',
    ''
  ].join('\n');

  writeFileSync(path.join(root, 'tests', 'specs', 'index.cjs'), source, 'utf8');
}

test('runTestEvidenceSpecification extracts SQL catalogs, SQL case catalogs, and test-case catalogs deterministically', () => {
  const root = createWorkspace('evidence-spec');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify(
      {
        id: 'orders.active-users.list',
        sqlFile: '../../sql/orders.active-users.list.sql',
        params: { shape: 'named' },
        output: { mapping: { columnMap: { userId: 'user_id' } } }
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(path.join(root, 'src', 'sql', 'orders.active-users.list.sql'), 'select user_id from users', 'utf8');
  writeSpecModule(root);

  const report = runTestEvidenceSpecification({ mode: 'specification', rootDir: root });
  expect(report.summary).toEqual({
    sqlCatalogCount: 1,
    sqlCaseCatalogCount: 1,
    testCaseCount: 2,
    specFilesScanned: 1,
    testFilesScanned: 1
  });
  expect(report.sqlCatalogs[0]).toMatchObject({
    id: 'orders.active-users.list',
    paramsShape: 'named',
    sqlFileResolved: true,
    specFile: 'src/catalog/specs/users.spec.json',
    hasOutputMapping: true
  });
  expect(report.testCases.map((item) => item.id)).toEqual([
    'unit.users.returns-active-users',
    'unit.users.skipped-case'
  ]);
  expect(report.sqlCaseCatalogs[0]).toMatchObject({
    id: 'sql.active-orders',
    cases: [
      { id: 'baseline', params: { active: 1, limit: 2, minTotal: 20 }, expected: [{ orderId: 10 }] },
      { id: 'inactive', params: { active: 0, limit: 2, minTotal: 20 }, expected: [{ orderId: 12 }] },
    ]
  });
});

test('runTestEvidenceSpecification throws when neither specs nor evidence module exports exist', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'evidence-empty-'));
  expect(() => runTestEvidenceSpecification({ mode: 'specification', rootDir: root })).toThrowError(TestEvidenceRuntimeError);
});

test('formatTestEvidenceOutput emits deterministic markdown and json text', () => {
  const root = createWorkspace('evidence-format');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'a.spec.json'),
    JSON.stringify({ id: 'a', sqlFile: '../../sql/a.sql', params: { shape: 'positional' } }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(root, 'src', 'sql', 'a.sql'), 'select 1', 'utf8');
  writeSpecModule(root, { testCaseIds: ['works'], includeSqlCase: false });

  const report = runTestEvidenceSpecification({ mode: 'specification', rootDir: root });
  const markdown = formatTestEvidenceOutput(report, 'markdown');
  const json = formatTestEvidenceOutput(report, 'json');

  expect(markdown).toContain('# Test Evidence (Specification Mode)');
  expect(markdown).toContain('`a`');
  expect(JSON.parse(json)).toMatchObject({
    schemaVersion: 1,
    mode: 'specification',
    summary: { sqlCatalogCount: 1, sqlCaseCatalogCount: 0, testCaseCount: 1 }
  });
  const parsed = JSON.parse(readFileSync(path.join(root, 'src', 'catalog', 'specs', 'a.spec.json'), 'utf8'));
  expect(parsed.id).toBe('a');
});

test('runTestEvidenceSpecification keeps deterministic ordering, normalized paths, and environment-free output', () => {
  const root = createWorkspace('evidence-determinism');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'b.spec.json'),
    JSON.stringify({ id: 'catalog.b', sqlFile: '../../sql/b.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'a.spec.json'),
    JSON.stringify({ id: 'catalog.a', sqlFile: '../../sql/a.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(root, 'src', 'sql', 'a.sql'), 'select 1', 'utf8');
  writeFileSync(path.join(root, 'src', 'sql', 'b.sql'), 'select 2', 'utf8');
  writeSpecModule(root, { testCaseIds: ['b', 'a'], includeSqlCase: false });

  const report = runTestEvidenceSpecification({ mode: 'specification', rootDir: root });
  expect(report.sqlCatalogs.map((item) => item.id)).toEqual(['catalog.a', 'catalog.b']);
  expect(report.testCases.map((item) => item.id)).toEqual(['unit.users.a', 'unit.users.b']);
  expect(report.sqlCatalogs.every((item) => !item.specFile.includes('\\'))).toBe(true);
  expect(JSON.stringify(report)).not.toContain(root);
  expect(JSON.stringify(report)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
});
