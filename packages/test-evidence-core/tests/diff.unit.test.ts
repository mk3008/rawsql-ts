import { expect, test } from 'vitest';
import { buildDiffJson, DiffCoreError, stableStringify, type PreviewJson } from '../src';

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
    cases: Array<{ id: string; title: string; input: unknown; output: unknown }>;
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
        output: testCase.output
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
