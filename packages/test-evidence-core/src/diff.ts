import {
  BuildDiffJsonArgs,
  DIFF_SCHEMA_VERSION,
  DiffCase,
  DiffCatalog,
  DiffJson
} from './types';
import { normalizeCatalogsForDiff, validatePreviewJson } from './preview';

/**
 * Stable stringify that sorts object keys recursively for deterministic fingerprints.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(toStableValue(value));
}

/**
 * Build deterministic diff JSON from base/head preview JSON inputs.
 */
export function buildDiffJson(args: BuildDiffJsonArgs): DiffJson {
  const basePreview = validatePreviewJson(args.base.previewJson, 'base');
  const headPreview = validatePreviewJson(args.head.previewJson, 'head');

  const baseCatalogs = normalizeCatalogsForDiff(basePreview);
  const headCatalogs = normalizeCatalogsForDiff(headPreview);
  const baseMap = new Map(baseCatalogs.map((catalog) => [catalog.catalogId, catalog]));
  const headMap = new Map(headCatalogs.map((catalog) => [catalog.catalogId, catalog]));

  const addedCatalogs: Array<{ catalogAfter: DiffCatalog }> = [];
  const removedCatalogs: Array<{ catalogBefore: DiffCatalog }> = [];
  const updatedCatalogs: Array<{
    catalogId: string;
    catalogBefore: DiffCatalog;
    catalogAfter: DiffCatalog;
    cases: {
      added: Array<{ after: DiffCase }>;
      removed: Array<{ before: DiffCase }>;
      updated: Array<{ before: DiffCase; after: DiffCase }>;
    };
  }> = [];

  for (const catalog of headCatalogs) {
    if (!baseMap.has(catalog.catalogId)) {
      addedCatalogs.push({ catalogAfter: catalog });
    }
  }
  for (const catalog of baseCatalogs) {
    if (!headMap.has(catalog.catalogId)) {
      removedCatalogs.push({ catalogBefore: catalog });
    }
  }

  for (const beforeCatalog of baseCatalogs) {
    const afterCatalog = headMap.get(beforeCatalog.catalogId);
    if (!afterCatalog) {
      continue;
    }
    const cases = diffCatalogCases(beforeCatalog, afterCatalog);
    const catalogChanged =
      stableStringify({
        kind: beforeCatalog.kind,
        catalogId: beforeCatalog.catalogId,
        title: beforeCatalog.title,
        definition: beforeCatalog.definition,
        fixtures: beforeCatalog.fixtures ?? []
      }) !==
      stableStringify({
        kind: afterCatalog.kind,
        catalogId: afterCatalog.catalogId,
        title: afterCatalog.title,
        definition: afterCatalog.definition,
        fixtures: afterCatalog.fixtures ?? []
      });

    if (catalogChanged || cases.added.length > 0 || cases.removed.length > 0 || cases.updated.length > 0) {
      updatedCatalogs.push({
        catalogId: beforeCatalog.catalogId,
        catalogBefore: beforeCatalog,
        catalogAfter: afterCatalog,
        cases
      });
    }
  }

  const addedCaseCountFromCatalogs = addedCatalogs.reduce((count, entry) => count + entry.catalogAfter.cases.length, 0);
  const removedCaseCountFromCatalogs = removedCatalogs.reduce((count, entry) => count + entry.catalogBefore.cases.length, 0);
  const addedCaseCountFromUpdates = updatedCatalogs.reduce((count, entry) => count + entry.cases.added.length, 0);
  const removedCaseCountFromUpdates = updatedCatalogs.reduce((count, entry) => count + entry.cases.removed.length, 0);
  const updatedCaseCount = updatedCatalogs.reduce((count, entry) => count + entry.cases.updated.length, 0);

  return {
    schemaVersion: DIFF_SCHEMA_VERSION,
    base: { ref: args.base.ref, sha: args.base.sha },
    head: { ref: args.head.ref, sha: args.head.sha },
    baseMode: args.baseMode,
    totals: {
      base: {
        catalogs: baseCatalogs.length,
        tests: baseCatalogs.reduce((count, catalog) => count + catalog.cases.length, 0)
      },
      head: {
        catalogs: headCatalogs.length,
        tests: headCatalogs.reduce((count, catalog) => count + catalog.cases.length, 0)
      }
    },
    summary: {
      catalogs: {
        added: addedCatalogs.length,
        removed: removedCatalogs.length,
        updated: updatedCatalogs.length
      },
      cases: {
        added: addedCaseCountFromCatalogs + addedCaseCountFromUpdates,
        removed: removedCaseCountFromCatalogs + removedCaseCountFromUpdates,
        updated: updatedCaseCount
      }
    },
    catalogs: {
      added: sortCatalogEntriesByKind(addedCatalogs, (entry) => entry.catalogAfter),
      removed: sortCatalogEntriesByKind(removedCatalogs, (entry) => entry.catalogBefore),
      updated: sortCatalogEntriesByKind(updatedCatalogs, (entry) => entry.catalogAfter)
    }
  };
}

function caseFingerprint(args: { catalog: DiffCatalog; testCase: DiffCase }): string {
  if (args.catalog.kind === 'sql') {
    return stableStringify({
      kind: args.catalog.kind,
      catalogId: args.catalog.catalogId,
      caseId: args.testCase.id,
      input: args.testCase.input,
      output: args.testCase.output,
      fixtures: args.catalog.fixtures ?? [],
      definition: args.catalog.definition ?? ''
    });
  }

  return stableStringify({
    kind: args.catalog.kind,
    catalogId: args.catalog.catalogId,
    caseId: args.testCase.id,
    input: args.testCase.input,
    output: args.testCase.output
  });
}

function diffCatalogCases(
  beforeCatalog: DiffCatalog,
  afterCatalog: DiffCatalog
): {
  added: Array<{ after: DiffCase }>;
  removed: Array<{ before: DiffCase }>;
  updated: Array<{ before: DiffCase; after: DiffCase }>;
} {
  const beforeMap = new Map(beforeCatalog.cases.map((testCase) => [testCase.id, testCase]));
  const afterMap = new Map(afterCatalog.cases.map((testCase) => [testCase.id, testCase]));
  const added: Array<{ after: DiffCase }> = [];
  const removed: Array<{ before: DiffCase }> = [];
  const updated: Array<{ before: DiffCase; after: DiffCase }> = [];

  for (const testCase of afterCatalog.cases) {
    if (!beforeMap.has(testCase.id)) {
      added.push({ after: testCase });
    }
  }
  for (const testCase of beforeCatalog.cases) {
    if (!afterMap.has(testCase.id)) {
      removed.push({ before: testCase });
    }
  }

  for (const beforeCase of beforeCatalog.cases) {
    const afterCase = afterMap.get(beforeCase.id);
    if (!afterCase) {
      continue;
    }
    if (
      caseFingerprint({ catalog: beforeCatalog, testCase: beforeCase }) !==
      caseFingerprint({ catalog: afterCatalog, testCase: afterCase })
    ) {
      updated.push({ before: beforeCase, after: afterCase });
    }
  }

  return {
    added: [...added].sort((a, b) => a.after.id.localeCompare(b.after.id)),
    removed: [...removed].sort((a, b) => a.before.id.localeCompare(b.before.id)),
    updated: [...updated].sort((a, b) => a.after.id.localeCompare(b.after.id))
  };
}

function sortCatalogEntriesByKind<T>(entries: T[], toCatalog: (entry: T) => DiffCatalog): T[] {
  return [...entries].sort((a, b) => {
    const catalogA = toCatalog(a);
    const catalogB = toCatalog(b);
    if (catalogA.kind !== catalogB.kind) {
      return catalogA.kind === 'sql' ? -1 : 1;
    }
    return catalogA.catalogId.localeCompare(catalogB.catalogId);
  });
}

function toStableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toStableValue(item));
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, nested]) => [key, toStableValue(nested)])
    );
  }
  return value;
}
