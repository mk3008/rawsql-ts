import { expect, test } from 'vitest';
import {
  buildDiffJson,
  DiffCoreError,
  type PreviewJson
} from '@rawsql-ts/test-evidence-core';
import {
  createCoercionCatalogPreviewJson,
  decimalTrimmedScenario
} from './_fixtures/coercionScenario';

function createPreviewJson(): PreviewJson {
  return {
    schemaVersion: 1,
    sqlCaseCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        cases: [
          {
            id: 'active-users',
            title: 'active users',
            params: { active: true },
            expected: [{ id: 1 }]
          }
        ]
      }
    ],
    testCaseCatalogs: [
      {
        id: 'fn.normalize',
        title: 'normalize',
        cases: [
          {
            id: 'trim',
            title: 'trim',
            input: ' A ',
            expected: 'success',
            output: 'a'
          }
        ]
      }
    ]
  };
}

test('sql-contract-zod can consume diff core and produce schemaVersioned DiffJson', () => {
  const diff = buildDiffJson({
    base: { ref: 'main', sha: 'base-sha', previewJson: createPreviewJson() },
    head: { ref: 'HEAD', sha: 'head-sha', previewJson: createPreviewJson() },
    baseMode: 'merge-base'
  });

  expect(diff.schemaVersion).toBe(1);
  expect(diff.base).toEqual({ ref: 'main', sha: 'base-sha' });
  expect(diff.head).toEqual({ ref: 'HEAD', sha: 'head-sha' });
  expect(diff.summary).toEqual({
    catalogs: { added: 0, removed: 0, updated: 0 },
    cases: { added: 0, removed: 0, updated: 0 }
  });
});

test('sql-contract-zod receives deterministic typed error for unsupported schemaVersion', () => {
  const unsupportedBase = {
    ...createPreviewJson(),
    schemaVersion: 99
  } as PreviewJson;

  try {
    buildDiffJson({
      base: { ref: 'main', sha: 'base-sha', previewJson: unsupportedBase },
      head: { ref: 'HEAD', sha: 'head-sha', previewJson: createPreviewJson() },
      baseMode: 'ref'
    });
    throw new Error('Expected buildDiffJson to throw for unsupported schemaVersion');
  } catch (error) {
    expect(error).toBeInstanceOf(DiffCoreError);
    expect(error).toMatchObject({
      code: 'UNSUPPORTED_SCHEMA_VERSION',
      path: 'base.schemaVersion',
      schemaVersion: 99
    });
  }
});

test('coercion catalog preview produces non-trivial updated and added case summary', () => {
  const diff = buildDiffJson({
    base: {
      ref: 'main',
      sha: 'base-sha',
      previewJson: createCoercionCatalogPreviewJson({
        decimalOutput: 33,
        includeBigIntCase: false
      })
    },
    head: {
      ref: 'HEAD',
      sha: 'head-sha',
      previewJson: createCoercionCatalogPreviewJson({
        decimalOutput: decimalTrimmedScenario.expectedOutput,
        includeBigIntCase: true
      })
    },
    baseMode: 'merge-base'
  });

  expect(diff.summary).toEqual({
    catalogs: { added: 0, removed: 0, updated: 1 },
    cases: { added: 1, removed: 0, updated: 1 }
  });
  expect(diff.catalogs.updated).toHaveLength(1);
  expect(diff.catalogs.updated[0]?.cases.added).toHaveLength(1);
  expect(diff.catalogs.updated[0]?.cases.updated).toHaveLength(1);
});
