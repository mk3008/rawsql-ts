import { expect, test } from 'vitest';
import {
  buildTestEvidencePrDiff,
  formatTestEvidencePrMarkdown,
  stableStringify,
  type TestSpecificationEvidence
} from '../src/commands/testEvidence';

function createReport(args: {
  sqlCatalogs?: Array<{
    id: string;
    title: string;
    definitionPath?: string;
    fixtures?: string[];
    cases: Array<{ id: string; title: string; input: Record<string, unknown>; output: unknown[] }>;
  }>;
  functionCatalogs?: Array<{
    id: string;
    title: string;
    definitionPath?: string;
    cases: Array<{ id: string; title: string; input: unknown; output: unknown }>;
  }>;
}): TestSpecificationEvidence {
  const sqlCatalogs = args.sqlCatalogs ?? [];
  const functionCatalogs = args.functionCatalogs ?? [];
  const testCaseCount =
    sqlCatalogs.reduce((count, catalog) => count + catalog.cases.length, 0) +
    functionCatalogs.reduce((count, catalog) => count + catalog.cases.length, 0);
  return {
    schemaVersion: 1,
    mode: 'specification',
    summary: {
      sqlCatalogCount: 0,
      sqlCaseCatalogCount: sqlCatalogs.length,
      testCaseCount,
      specFilesScanned: 0,
      testFilesScanned: 0
    },
    sqlCatalogs: [],
    sqlCaseCatalogs: sqlCatalogs.map((catalog) => ({
      id: catalog.id,
      title: catalog.title,
      ...(catalog.definitionPath ? { definitionPath: catalog.definitionPath } : {}),
      params: { shape: 'named', example: {} },
      output: { mapping: { columnMap: {} } },
      sql: 'select 1',
      fixtures: (catalog.fixtures ?? []).map((tableName) => ({ tableName, rowsCount: 0 })),
      cases: catalog.cases.map((testCase) => ({
        id: testCase.id,
        title: testCase.title,
        params: testCase.input,
        expected: testCase.output
      }))
    })),
    testCaseCatalogs: functionCatalogs.map((catalog) => ({
      id: catalog.id,
      title: catalog.title,
      ...(catalog.definitionPath ? { definitionPath: catalog.definitionPath } : {}),
      cases: catalog.cases.map((testCase) => ({
        id: testCase.id,
        title: testCase.title,
        input: testCase.input,
        output: testCase.output
      }))
    })),
    testCases: []
  };
}

test('stableStringify keeps deterministic key ordering', () => {
  expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
});

test('fixtures ordering difference does not create updates', () => {
  const base = createReport({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        definitionPath: 'src/specs/sql/users.ts',
        fixtures: ['users', 'orders'],
        cases: [{ id: 'baseline', title: 'baseline', input: { active: 1 }, output: [{ id: 1 }] }]
      }
    ]
  });
  const head = createReport({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        definitionPath: 'src/specs/sql/users.ts',
        fixtures: ['orders', 'users'],
        cases: [{ id: 'baseline', title: 'baseline', input: { active: 1 }, output: [{ id: 1 }] }]
      }
    ]
  });

  const diff = buildTestEvidencePrDiff({
    base: { ref: 'main', sha: 'a', report: base },
    head: { ref: 'HEAD', sha: 'b', report: head },
    baseMode: 'merge-base'
  });
  expect(diff.summary.catalogs).toEqual({ added: 0, removed: 0, updated: 0 });
  expect(diff.summary.cases).toEqual({ added: 0, removed: 0, updated: 0 });
  expect(diff.baseMode).toBe('merge-base');
  expect(diff.totals.base).toEqual({ catalogs: 1, tests: 1 });
  expect(diff.totals.head).toEqual({ catalogs: 1, tests: 1 });
});

test('input/output change is reported as case updated', () => {
  const base = createReport({
    functionCatalogs: [
      {
        id: 'unit.normalize',
        title: 'normalize',
        cases: [{ id: 'trim', title: 'trim', input: ' A ', output: 'a' }]
      }
    ]
  });
  const head = createReport({
    functionCatalogs: [
      {
        id: 'unit.normalize',
        title: 'normalize',
        cases: [{ id: 'trim', title: 'trim', input: ' A ', output: 'aa' }]
      }
    ]
  });

  const diff = buildTestEvidencePrDiff({
    base: { ref: 'main', sha: 'a', report: base },
    head: { ref: 'HEAD', sha: 'b', report: head },
    baseMode: 'ref'
  });
  expect(diff.summary.catalogs.updated).toBe(1);
  expect(diff.summary.cases.updated).toBe(1);
  expect(diff.catalogs.updated[0]?.cases.updated[0]?.before.output).toBe('a');
  expect(diff.catalogs.updated[0]?.cases.updated[0]?.after.output).toBe('aa');
});

test('catalog and case add/remove are classified correctly', () => {
  const base = createReport({
    sqlCatalogs: [
      {
        id: 'sql.base',
        title: 'base',
        cases: [{ id: 'a', title: 'a', input: {}, output: [] }]
      }
    ],
    functionCatalogs: [
      {
        id: 'unit.only-base',
        title: 'base-fn',
        cases: [{ id: 'x', title: 'x', input: 1, output: 1 }]
      }
    ]
  });
  const head = createReport({
    sqlCatalogs: [
      {
        id: 'sql.base',
        title: 'base',
        cases: [{ id: 'b', title: 'b', input: {}, output: [] }]
      },
      {
        id: 'sql.new',
        title: 'new',
        cases: [{ id: 'n', title: 'n', input: {}, output: [] }]
      }
    ]
  });

  const diff = buildTestEvidencePrDiff({
    base: { ref: 'main', sha: 'a', report: base },
    head: { ref: 'HEAD', sha: 'b', report: head },
    baseMode: 'ref'
  });
  expect(diff.summary.catalogs).toEqual({ added: 1, removed: 1, updated: 1 });
  expect(diff.summary.cases).toEqual({ added: 2, removed: 2, updated: 0 });
});

test('markdown header shows merge-base expression when baseMode=merge-base', () => {
  const diff = buildTestEvidencePrDiff({
    base: { ref: 'main', sha: 'aaa', report: createReport({}) },
    head: { ref: 'HEAD', sha: 'bbb', report: createReport({}) },
    baseMode: 'merge-base'
  });
  const markdown = formatTestEvidencePrMarkdown(diff);
  expect(markdown).toContain('- base: merge-base(main, HEAD) (aaa)');
  expect(markdown).toContain('- head: HEAD (bbb)');
});

test('test-centric markdown groups changed cases under a single catalog heading', () => {
  const base = createReport({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        definitionPath: 'src/specs/sql/users.ts',
        fixtures: ['users'],
        cases: [
          { id: 'baseline', title: 'baseline', input: { active: 1 }, output: [{ id: 1 }] },
          { id: 'removed-case', title: 'removed', input: { active: 9 }, output: [{ id: 9 }] }
        ]
      }
    ]
  });
  const head = createReport({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        definitionPath: 'src/specs/sql/users.ts',
        fixtures: ['users'],
        cases: [
          { id: 'baseline', title: 'baseline', input: { active: 0 }, output: [{ id: 2 }] },
          { id: 'added-case', title: 'added', input: { active: 2 }, output: [{ id: 3 }] }
        ]
      }
    ]
  });
  const diff = buildTestEvidencePrDiff({
    base: { ref: 'main', sha: 'a', report: base },
    head: { ref: 'HEAD', sha: 'b', report: head },
    baseMode: 'ref'
  });
  const markdown = formatTestEvidencePrMarkdown(diff);
  expect(markdown.match(/## sql\.users - users/g)?.length).toBe(1);
  expect(markdown).toContain('[File](src/specs/sql/users.ts)');
  expect(markdown).toContain('### ADD: added-case - added');
  expect(markdown).toContain('**after**');
  expect(markdown).toContain('### REMOVE: removed-case - removed');
  expect(markdown).toContain('**before**');
  expect(markdown).toContain('### UPDATE: baseline - baseline');
});

test('removed cases always render before blocks in test-centric markdown', () => {
  const base = createReport({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        cases: [{ id: 'removed-case', title: 'removed', input: { active: 9 }, output: [{ id: 9 }] }]
      }
    ]
  });
  const head = createReport({});
  const diff = buildTestEvidencePrDiff({
    base: { ref: 'main', sha: 'a', report: base },
    head: { ref: 'HEAD', sha: 'b', report: head },
    baseMode: 'ref'
  });

  const markdown = formatTestEvidencePrMarkdown(diff, { removedDetail: 'none' });
  expect(markdown).toContain('### REMOVE: removed-case - removed');
  expect(markdown).toContain('**before**');
  expect(markdown).toContain('input');
  expect(markdown).toContain('output');
  expect(markdown).not.toContain('**after**');
});

test('diff json uses schemaVersion', () => {
  const diff = buildTestEvidencePrDiff({
    base: { ref: 'main', sha: 'aaa', report: createReport({}) },
    head: { ref: 'HEAD', sha: 'bbb', report: createReport({}) },
    baseMode: 'merge-base'
  });

  expect(diff).toMatchObject({ schemaVersion: 1 });
});

test('unsupported preview schemaVersion is rejected deterministically', () => {
  const base = {
    ...createReport({}),
    schemaVersion: 2
  } as unknown as TestSpecificationEvidence;
  const head = createReport({});

  expect(() =>
    buildTestEvidencePrDiff({
      base: { ref: 'main', sha: 'aaa', report: base },
      head: { ref: 'HEAD', sha: 'bbb', report: head },
      baseMode: 'merge-base'
    })
  ).toThrow(/schemaVersion|unsupported/i);
});

