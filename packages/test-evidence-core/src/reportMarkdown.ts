import { DIFF_SCHEMA_VERSION, DiffCoreError, DiffJson, PREVIEW_SCHEMA_VERSION } from './types';

export type DiffReportMarkdownMeta = {
  generatedAt: string;
  unsupportedSchemaValidation?: {
    checked: boolean;
    passed: boolean;
  };
};

type CatalogChangeRow = {
  catalogId: string;
  title: string;
  definitionPath: string;
  casesAdded: string[];
  casesRemoved: string[];
  casesUpdated: string[];
};

/**
 * Render a deterministic markdown report from DiffJson facts.
 */
export function renderDiffReportMarkdown(diff: DiffJson, meta: DiffReportMarkdownMeta): string {
  const lines: string[] = [];
  const rows = collectCatalogChangeRows(diff);

  lines.push('# Header');
  lines.push(`- generatedAt: ${meta.generatedAt}`);
  lines.push(`- schemaVersion: ${diff.schemaVersion}`);
  lines.push(`- base.ref: ${diff.base.ref}`);
  lines.push(`- base.sha: ${diff.base.sha}`);
  lines.push(`- head.ref: ${diff.head.ref}`);
  lines.push(`- head.sha: ${diff.head.sha}`);
  lines.push(`- baseMode: ${diff.baseMode}`);
  lines.push('');

  lines.push('# Summary');
  lines.push(`- catalogs.added: ${diff.summary.catalogs.added}`);
  lines.push(`- catalogs.removed: ${diff.summary.catalogs.removed}`);
  lines.push(`- catalogs.updated: ${diff.summary.catalogs.updated}`);
  lines.push(`- cases.added: ${diff.summary.cases.added}`);
  lines.push(`- cases.removed: ${diff.summary.cases.removed}`);
  lines.push(`- cases.updated: ${diff.summary.cases.updated}`);
  lines.push('');

  lines.push('# Catalog changes');
  for (const row of rows) {
    lines.push(`- catalogId: ${row.catalogId}`);
    lines.push(`  - title: ${row.title}`);
    lines.push(`  - definitionPath: ${row.definitionPath}`);
    lines.push(`  - cases.added: ${formatIdList(row.casesAdded)}`);
    lines.push(`  - cases.removed: ${formatIdList(row.casesRemoved)}`);
    lines.push(`  - cases.updated: ${formatIdList(row.casesUpdated)}`);
  }
  if (rows.length === 0) {
    lines.push('- none');
  }
  lines.push('');

  lines.push('# Validation');
  lines.push(`- schemaVersionSupported: ${diff.schemaVersion === DIFF_SCHEMA_VERSION ? 'yes' : 'no'}`);
  if (meta.unsupportedSchemaValidation?.checked) {
    lines.push(
      `- deterministicUnsupportedSchemaErrorPresent: ${meta.unsupportedSchemaValidation.passed ? 'yes' : 'no'}`
    );
  } else {
    lines.push('- deterministicUnsupportedSchemaErrorPresent: not-evaluated');
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Execute deterministic unsupported-schema validation by probing buildDiffJson with schemaVersion+1.
 */
export function evaluateUnsupportedSchemaValidation(args: {
  buildDiffJson: (input: {
    base: { ref: string; sha: string; previewJson: any };
    head: { ref: string; sha: string; previewJson: any };
    baseMode: 'merge-base' | 'ref';
  }) => DiffJson;
  base: { ref: string; sha: string; previewJson: any };
  head: { ref: string; sha: string; previewJson: any };
  baseMode: 'merge-base' | 'ref';
}): { checked: boolean; passed: boolean } {
  const mutatedBase = {
    ...args.base.previewJson,
    schemaVersion: PREVIEW_SCHEMA_VERSION + 1
  };

  try {
    args.buildDiffJson({
      base: { ref: args.base.ref, sha: args.base.sha, previewJson: mutatedBase },
      head: args.head,
      baseMode: args.baseMode
    });
    return { checked: true, passed: false };
  } catch (error) {
    const deterministic =
      error instanceof DiffCoreError &&
      error.code === 'UNSUPPORTED_SCHEMA_VERSION' &&
      error.path === 'base.schemaVersion' &&
      error.schemaVersion === PREVIEW_SCHEMA_VERSION + 1;
    return { checked: true, passed: deterministic };
  }
}

function collectCatalogChangeRows(diff: DiffJson): CatalogChangeRow[] {
  const map = new Map<string, CatalogChangeRow>();

  // Seed with added/removed catalogs so case IDs from full catalog snapshots are included deterministically.
  for (const entry of diff.catalogs.added) {
    map.set(entry.catalogAfter.catalogId, {
      catalogId: entry.catalogAfter.catalogId,
      title: entry.catalogAfter.title,
      definitionPath: entry.catalogAfter.definition ?? '',
      casesAdded: entry.catalogAfter.cases.map((testCase) => testCase.id).sort((a, b) => a.localeCompare(b)),
      casesRemoved: [],
      casesUpdated: []
    });
  }
  for (const entry of diff.catalogs.removed) {
    map.set(entry.catalogBefore.catalogId, {
      catalogId: entry.catalogBefore.catalogId,
      title: entry.catalogBefore.title,
      definitionPath: entry.catalogBefore.definition ?? '',
      casesAdded: [],
      casesRemoved: entry.catalogBefore.cases.map((testCase) => testCase.id).sort((a, b) => a.localeCompare(b)),
      casesUpdated: []
    });
  }

  for (const entry of diff.catalogs.updated) {
    const row = map.get(entry.catalogId) ?? {
      catalogId: entry.catalogId,
      title: entry.catalogAfter.title,
      definitionPath: entry.catalogAfter.definition ?? '',
      casesAdded: [],
      casesRemoved: [],
      casesUpdated: []
    };
    row.title = entry.catalogAfter.title;
    row.definitionPath = entry.catalogAfter.definition ?? '';
    row.casesAdded = entry.cases.added.map((item) => item.after.id).sort((a, b) => a.localeCompare(b));
    row.casesRemoved = entry.cases.removed.map((item) => item.before.id).sort((a, b) => a.localeCompare(b));
    row.casesUpdated = entry.cases.updated.map((item) => item.after.id).sort((a, b) => a.localeCompare(b));
    map.set(entry.catalogId, row);
  }

  return [...map.values()].sort((a, b) => a.catalogId.localeCompare(b.catalogId));
}

function formatIdList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : '-';
}
