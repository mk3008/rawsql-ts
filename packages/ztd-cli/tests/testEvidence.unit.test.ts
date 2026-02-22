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
    "    definitionPath: 'tests/specs/users.catalog.ts',",
    '    cases: [',
    ...testCaseIds.map((id) => `      { id: '${id}', title: '${id.replace(/-/g, ' ')}', input: '${id}', expected: 'success', output: '${id}-ok', tags: ['invariant', 'state'], focus: 'Ensures ${id.replace(/-/g, ' ')} behavior remains stable.' },`),
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

  expect(markdown).toContain('# unit.users Test Cases');
  expect(markdown).toContain('- tests: 1');
  expect(markdown).toContain("definition: [tests/specs/users.catalog.ts](tests/specs/users.catalog.ts)");
  expect(markdown).toContain('## works - works');
  expect(markdown).not.toContain('\n---\n');
  expect(markdown).toContain('### input');
  expect(markdown).toContain('### output');
  expect(markdown).not.toContain('## SQL Unit Tests');
  expect(markdown).not.toContain('## Function Unit Tests');
  expect(markdown).toContain('"works"');
  expect(markdown).toContain('"works-ok"');
  expect(markdown).not.toContain('SELECT');
  expect(JSON.parse(json)).toMatchObject({
    schemaVersion: 1,
    mode: 'specification',
    summary: { sqlCatalogCount: 1, sqlCaseCatalogCount: 0, testCaseCount: 1 }
  });
  const parsed = JSON.parse(readFileSync(path.join(root, 'src', 'catalog', 'specs', 'a.spec.json'), 'utf8'));
  expect(parsed.id).toBe('a');
});

test('formatTestEvidenceOutput uses GitHub HTTPS links when CI metadata exists', () => {
  const root = createWorkspace('evidence-github-links');
  writeSpecModule(root, { testCaseIds: ['works'], includeSqlCase: false });
  const report = runTestEvidenceSpecification({ mode: 'specification', rootDir: root });

  const originalServer = process.env.GITHUB_SERVER_URL;
  const originalRepo = process.env.GITHUB_REPOSITORY;
  const originalSha = process.env.GITHUB_SHA;
  try {
    process.env.GITHUB_SERVER_URL = 'https://github.com';
    process.env.GITHUB_REPOSITORY = 'mk3008/rawsql-ts';
    process.env.GITHUB_SHA = 'abc123';
    const markdown = formatTestEvidenceOutput(report, 'markdown');
    expect(markdown).toContain(
      '[tests/specs/users.catalog.ts](https://github.com/mk3008/rawsql-ts/blob/abc123/tests/specs/users.catalog.ts)'
    );
  } finally {
    process.env.GITHUB_SERVER_URL = originalServer;
    process.env.GITHUB_REPOSITORY = originalRepo;
    process.env.GITHUB_SHA = originalSha;
  }
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
  expect(report.testCaseCatalogs.map((item) => item.id)).toEqual(['unit.users']);
  expect(report.testCaseCatalogs[0]?.definitionPath).toBe('tests/specs/users.catalog.ts');
  expect(report.testCaseCatalogs[0]?.cases[0]).toMatchObject({
    id: 'a',
    input: 'a',
    output: 'a-ok',
    tags: ['invariant', 'state'],
    focus: 'Ensures a behavior remains stable.'
  });
  expect(report.sqlCatalogs.every((item) => !item.specFile.includes('\\'))).toBe(true);
  expect(JSON.stringify(report)).not.toContain(root);
  expect(JSON.stringify(report)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
});

test('runTestEvidenceSpecification normalizes tags vocabulary and keeps catalog refs', () => {
  const root = createWorkspace('evidence-tags-refs');
  writeFileSync(
    path.join(root, 'tests', 'specs', 'index.cjs'),
    [
      'module.exports = {',
      'testCaseCatalogs: [',
      '  {',
      "    id: 'unit.tags',",
      "    title: 'tags',",
      "    refs: [{ label: 'Issue #448', url: 'https://github.com/mk3008/rawsql-ts/issues/448' }],",
      '    cases: [',
      "      { id: 'c1', title: 'c1', input: 'x', expected: 'success', output: 'x', tags: ['happy-path', 'validation', 'bva', 'ep'], focus: 'Ensures tags are normalized into two axes.' }",
      '    ]',
      '  }',
      '],',
      'sqlCatalogCases: []',
      '};',
      ''
    ].join('\n'),
    'utf8'
  );

  const report = runTestEvidenceSpecification({ mode: 'specification', rootDir: root });
  expect(report.testCaseCatalogs[0]?.refs).toEqual([
    { label: 'Issue #448', url: 'https://github.com/mk3008/rawsql-ts/issues/448' }
  ]);
  expect(report.testCaseCatalogs[0]?.cases[0]?.tags).toEqual(['validation', 'ep']);
  expect(report.testCaseCatalogs[0]?.cases[0]?.focus).toBe('Ensures tags are normalized into two axes.');
});

