import { expect, test } from 'vitest';
import {
  buildDiffJson,
  DiffCoreError,
  renderDiffReportMarkdown,
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

test('renderDiffReportMarkdown prints deterministic fact-only markdown', () => {
  const diff = buildDiffJson({
    base: {
      ref: 'main',
      sha: 'aaa111',
      previewJson: createPreview({
        functionCatalogs: [
          {
            id: 'fn.coercions',
            title: 'coercion helper parity',
            definitionPath: 'packages/sql-contract-zod/tests/coercions.test.ts',
            cases: [{ id: 'decimal-trimmed', title: 'decimal', input: ' 33.5 ', output: 33 }]
          }
        ]
      })
    },
    head: {
      ref: 'HEAD',
      sha: 'bbb222',
      previewJson: createPreview({
        functionCatalogs: [
          {
            id: 'fn.coercions',
            title: 'coercion helper parity',
            definitionPath: 'packages/sql-contract-zod/tests/coercions.test.ts',
            cases: [
              { id: 'decimal-trimmed', title: 'decimal', input: ' 33.5 ', output: 33.5 },
              {
                id: 'bigint-trimmed',
                title: 'bigint',
                input: ' 123456789012345678901234567890 ',
                output: '123456789012345678901234567890n'
              }
            ]
          }
        ]
      })
    },
    baseMode: 'merge-base'
  });

  const markdown = renderDiffReportMarkdown(diff, {
    generatedAt: '2026-02-21T00:00:00.000Z',
    unsupportedSchemaValidation: { checked: true, passed: true }
  });

  expect(markdown).toBe(
    [
      '# Header',
      '- generatedAt: 2026-02-21T00:00:00.000Z',
      '- schemaVersion: 1',
      '- base.ref: main',
      '- base.sha: aaa111',
      '- head.ref: HEAD',
      '- head.sha: bbb222',
      '- baseMode: merge-base',
      '',
      '# Summary',
      '- catalogs.added: 0',
      '- catalogs.removed: 0',
      '- catalogs.updated: 1',
      '- cases.added: 1',
      '- cases.removed: 0',
      '- cases.updated: 1',
      '',
      '# Catalog changes',
      '- catalogId: fn.coercions',
      '  - title: coercion helper parity',
      '  - definitionPath: packages/sql-contract-zod/tests/coercions.test.ts',
      '  - cases.added: bigint-trimmed',
      '  - cases.removed: -',
      '  - cases.updated: decimal-trimmed',
      '',
      '# Validation',
      '- schemaVersionSupported: yes',
      '- deterministicUnsupportedSchemaErrorPresent: yes',
      ''
    ].join('\n')
  );
});
