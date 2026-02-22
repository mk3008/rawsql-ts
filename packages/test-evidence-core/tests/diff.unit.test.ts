import { expect, test } from 'vitest';
import {
  buildDiffJson,
  buildSpecificationModel,
  DiffCoreError,
  stableStringify,
  type PreviewJson
} from '../src';

function createPreview(args: {
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
    cases: Array<{
      id: string;
      title: string;
      input: unknown;
      expected?: 'success' | 'throws' | 'errorResult';
      output?: unknown;
      error?: { name: string; message: string; match: 'equals' | 'contains' };
    }>;
  }>;
}): PreviewJson {
  const sqlCatalogs = args.sqlCatalogs ?? [];
  const functionCatalogs = args.functionCatalogs ?? [];

  return {
    schemaVersion: 1,
    sqlCaseCatalogs: sqlCatalogs.map((catalog) => ({
      id: catalog.id,
      title: catalog.title,
      ...(catalog.definitionPath ? { definitionPath: catalog.definitionPath } : {}),
      fixtures: (catalog.fixtures ?? []).map((tableName) => ({ tableName })),
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
        expected: testCase.expected ?? 'success',
        ...(testCase.expected === 'throws' ? { error: testCase.error } : { output: testCase.output })
      }))
    }))
  };
}

test('stableStringify keeps deterministic key ordering', () => {
  expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
});

test('buildDiffJson returns schemaVersion=1', () => {
  const diff = buildDiffJson({
    base: { ref: 'main', sha: 'a', previewJson: createPreview({}) },
    head: { ref: 'HEAD', sha: 'b', previewJson: createPreview({}) },
    baseMode: 'merge-base'
  });

  expect(diff).toMatchObject({ schemaVersion: 1 });
});

test('unsupported preview schemaVersion throws deterministic typed error', () => {
  const base = {
    ...createPreview({}),
    schemaVersion: 2
  } as unknown as PreviewJson;

  try {
    buildDiffJson({
      base: { ref: 'main', sha: 'a', previewJson: base },
      head: { ref: 'HEAD', sha: 'b', previewJson: createPreview({}) },
      baseMode: 'ref'
    });
    throw new Error('expected buildDiffJson to throw');
  } catch (error) {
    expect(error).toBeInstanceOf(DiffCoreError);
    expect(error).toMatchObject({
      code: 'UNSUPPORTED_SCHEMA_VERSION',
      path: 'base.schemaVersion',
      schemaVersion: 2
    });
  }
});

test('buildSpecificationModel returns deterministic pure intermediate model', () => {
  const preview = createPreview({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        definitionPath: 'src/specs/sql/users.ts',
        fixtures: ['users'],
        cases: [{ id: 'active-users', title: 'active users', input: { active: true }, output: [{ id: 1 }] }]
      }
    ],
    functionCatalogs: [
      {
        id: 'fn.normalize',
        title: 'normalize',
        definitionPath: 'tests/specs/fn.ts',
        cases: [{ id: 'trim', title: 'trim', input: ' A ', output: 'a' }]
      }
    ]
  });

  const model = buildSpecificationModel(preview);
  expect(model.schemaVersion).toBe(1);
  expect(model.totals).toEqual({
    catalogs: 2,
    sqlCatalogs: 1,
    functionCatalogs: 1,
    tests: 2
  });
  expect(model.catalogs.map((catalog) => catalog.catalogId)).toEqual(['fn.normalize', 'sql.users']);
  expect(stableStringify(model)).toBe(stableStringify(buildSpecificationModel(preview)));
});

test('buildSpecificationModel rejects unsupported schemaVersion with preview path', () => {
  const preview = {
    ...createPreview({}),
    schemaVersion: 99
  } as unknown as PreviewJson;

  try {
    buildSpecificationModel(preview);
    throw new Error('expected buildSpecificationModel to throw');
  } catch (error) {
    expect(error).toBeInstanceOf(DiffCoreError);
    expect(error).toMatchObject({
      code: 'UNSUPPORTED_SCHEMA_VERSION',
      path: 'preview.schemaVersion',
      schemaVersion: 99
    });
  }
});

test('buildSpecificationModel validates throws case contract deterministically', () => {
  const preview = createPreview({
    functionCatalogs: [
      {
        id: 'unit.normalize',
        title: 'normalize',
        cases: [
          {
            id: 'throws-case',
            title: 'throws',
            input: 'invalid',
            expected: 'throws',
            error: { name: 'Error', message: 'invalid email', match: 'contains' }
          }
        ]
      }
    ]
  });
  const model = buildSpecificationModel(preview);
  expect(model.catalogs[0]?.cases[0]).toMatchObject({
    expected: 'throws',
    error: { name: 'Error', message: 'invalid email', match: 'contains' }
  });
});
