import { DiffCase, DiffCatalog, DiffJson } from '@rawsql-ts/test-evidence-core';
import { DefinitionLinkOptions, formatDefinitionMarkdown, formatFileLinkMarkdown } from './definitionLink';

export type RemovedDetailLevel = 'none' | 'input' | 'full';

type CaseDelta = {
  changeType: 'ADD' | 'UPDATE' | 'REMOVE';
  id: string;
  title: string;
  inputBefore?: unknown;
  inputAfter?: unknown;
  outputBefore?: unknown;
  outputAfter?: unknown;
};

type CatalogCaseGroup = {
  catalogId: string;
  title: string;
  definitionPath: string;
  cases: CaseDelta[];
};

/**
 * Legacy PR markdown renderer kept for parity snapshot baseline.
 */
export function renderLegacyDiffMarkdown(
  diff: DiffJson,
  options?: { removedDetail?: RemovedDetailLevel; definitionLinks?: DefinitionLinkOptions }
): string {
  const removedDetail = options?.removedDetail ?? 'input';
  const definitionLinks = options?.definitionLinks;
  const lines: string[] = [];
  lines.push('# Test Evidence (PR Diff)');
  lines.push('');
  if (diff.baseMode === 'merge-base') {
    lines.push(`- base: merge-base(${diff.base.ref}, ${diff.head.ref}) (${diff.base.sha})`);
  } else {
    lines.push(`- base: ${diff.base.ref} (${diff.base.sha})`);
  }
  lines.push(`- head: ${diff.head.ref} (${diff.head.sha})`);
  lines.push(`- base-mode: ${diff.baseMode}`);
  lines.push(`- catalogs: +${diff.summary.catalogs.added} / -${diff.summary.catalogs.removed} / ~${diff.summary.catalogs.updated}`);
  lines.push(`- tests: +${diff.summary.cases.added} / -${diff.summary.cases.removed} / ~${diff.summary.cases.updated}`);
  lines.push(`- base totals: catalogs=${diff.totals.base.catalogs} tests=${diff.totals.base.tests}`);
  lines.push(`- head totals: catalogs=${diff.totals.head.catalogs} tests=${diff.totals.head.tests}`);
  lines.push('');

  lines.push('## Added catalogs');
  lines.push('');
  if (diff.catalogs.added.length === 0 && diff.catalogs.updated.every((entry) => entry.cases.added.length === 0)) {
    lines.push('- (none)');
    lines.push('');
  } else {
    for (const entry of diff.catalogs.added) {
      renderCatalogHeader(lines, entry.catalogAfter, definitionLinks);
      for (const [index, testCase] of entry.catalogAfter.cases.entries()) {
        renderCase(lines, testCase);
        if (index < entry.catalogAfter.cases.length - 1) {
          lines.push('---');
          lines.push('');
        }
      }
    }
  }

  lines.push('## Removed catalogs');
  lines.push('');
  if (diff.catalogs.removed.length === 0 && diff.catalogs.updated.every((entry) => entry.cases.removed.length === 0)) {
    lines.push('- (none)');
    lines.push('');
  } else {
    for (const entry of diff.catalogs.removed) {
      renderCatalogHeader(lines, entry.catalogBefore, definitionLinks);
      for (const [index, testCase] of entry.catalogBefore.cases.entries()) {
        renderRemovedCase(lines, testCase, removedDetail);
        if (index < entry.catalogBefore.cases.length - 1) {
          lines.push('---');
          lines.push('');
        }
      }
    }
  }

  lines.push('## Updated catalogs');
  lines.push('');
  if (diff.catalogs.updated.length === 0) {
    lines.push('- (none)');
    lines.push('');
  } else {
    for (const entry of diff.catalogs.updated) {
      if (
        entry.cases.added.length === 0 &&
        entry.cases.removed.length === 0 &&
        entry.cases.updated.length === 0
      ) {
        continue;
      }
      renderCatalogHeader(lines, entry.catalogAfter, definitionLinks);
      if (entry.cases.added.length > 0) {
        lines.push('#### Added cases');
        lines.push('');
        for (const [index, testCase] of entry.cases.added.map((item) => item.after).entries()) {
          renderCase(lines, testCase);
          if (index < entry.cases.added.length - 1) {
            lines.push('---');
            lines.push('');
          }
        }
      }
      if (entry.cases.removed.length > 0) {
        lines.push('#### Removed cases');
        lines.push('');
        for (const [index, testCase] of entry.cases.removed.map((item) => item.before).entries()) {
          renderRemovedCase(lines, testCase, removedDetail);
          if (index < entry.cases.removed.length - 1) {
            lines.push('---');
            lines.push('');
          }
        }
      }
      if (entry.cases.updated.length > 0) {
        lines.push('#### Updated cases');
        lines.push('');
        for (const [index, updated] of entry.cases.updated.entries()) {
          lines.push(`### ${updated.after.id} - ${updated.after.title}`);
          lines.push('input (before):');
          lines.push('```json');
          lines.push(JSON.stringify(updated.before.input, null, 2));
          lines.push('```');
          lines.push('input (after):');
          lines.push('```json');
          lines.push(JSON.stringify(updated.after.input, null, 2));
          lines.push('```');
          lines.push('output (before):');
          lines.push('```json');
          lines.push(JSON.stringify(updated.before.output, null, 2));
          lines.push('```');
          lines.push('output (after):');
          lines.push('```json');
          lines.push(JSON.stringify(updated.after.output, null, 2));
          lines.push('```');
          lines.push('');
          if (index < entry.cases.updated.length - 1) {
            lines.push('---');
            lines.push('');
          }
        }
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Test-centric PR markdown renderer.
 */
export function renderDiffMarkdown(diff: DiffJson, options?: { definitionLinks?: DefinitionLinkOptions }): string {
  const definitionLinks = options?.definitionLinks;
  const lines: string[] = [];
  lines.push('# Test Evidence (PR Diff)');
  lines.push('');
  if (diff.baseMode === 'merge-base') {
    lines.push(`- base: merge-base(${diff.base.ref}, ${diff.head.ref}) (${diff.base.sha})`);
  } else {
    lines.push(`- base: ${diff.base.ref} (${diff.base.sha})`);
  }
  lines.push(`- head: ${diff.head.ref} (${diff.head.sha})`);
  lines.push(`- base-mode: ${diff.baseMode}`);
  lines.push(`- tests: +${diff.summary.cases.added} / ~${diff.summary.cases.updated} / -${diff.summary.cases.removed}`);
  lines.push(`- base totals: tests=${diff.totals.base.tests}`);
  lines.push(`- head totals: tests=${diff.totals.head.tests}`);
  lines.push('');

  const groups = buildCatalogCaseGroups(diff);
  for (const group of groups) {
    lines.push(`## ${group.catalogId} - ${group.title}`);
    lines.push('');
    lines.push(formatFileLinkMarkdown(group.definitionPath, definitionLinks));
    lines.push('');
    for (const testCase of group.cases) {
      lines.push(`### ${testCase.changeType}: ${testCase.id} - ${testCase.title}`);
      lines.push('');
      appendCaseBlocks(lines, testCase);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function buildCatalogCaseGroups(diff: DiffJson): CatalogCaseGroup[] {
  const groups = new Map<string, CatalogCaseGroup>();

  for (const entry of diff.catalogs.added) {
    const group = getOrCreateGroup(
      groups,
      entry.catalogAfter.catalogId,
      entry.catalogAfter.title,
      entry.catalogAfter.definition ?? '(unknown)'
    );
    for (const testCase of entry.catalogAfter.cases) {
      group.cases.push({
        changeType: 'ADD',
        id: testCase.id,
        title: testCase.title,
        inputAfter: testCase.input,
        outputAfter: testCase.output
      });
    }
  }
  for (const entry of diff.catalogs.removed) {
    const group = getOrCreateGroup(
      groups,
      entry.catalogBefore.catalogId,
      entry.catalogBefore.title,
      entry.catalogBefore.definition ?? '(unknown)'
    );
    for (const testCase of entry.catalogBefore.cases) {
      group.cases.push({
        changeType: 'REMOVE',
        id: testCase.id,
        title: testCase.title,
        inputBefore: testCase.input,
        outputBefore: testCase.output
      });
    }
  }
  for (const entry of diff.catalogs.updated) {
    const group = getOrCreateGroup(
      groups,
      entry.catalogAfter.catalogId,
      entry.catalogAfter.title,
      entry.catalogAfter.definition ?? '(unknown)'
    );
    for (const added of entry.cases.added) {
      group.cases.push({
        changeType: 'ADD',
        id: added.after.id,
        title: added.after.title,
        inputAfter: added.after.input,
        outputAfter: added.after.output
      });
    }
    for (const removed of entry.cases.removed) {
      group.cases.push({
        changeType: 'REMOVE',
        id: removed.before.id,
        title: removed.before.title,
        inputBefore: removed.before.input,
        outputBefore: removed.before.output
      });
    }
    for (const updated of entry.cases.updated) {
      group.cases.push({
        changeType: 'UPDATE',
        id: updated.after.id,
        title: updated.after.title,
        inputBefore: updated.before.input,
        inputAfter: updated.after.input,
        outputBefore: updated.before.output,
        outputAfter: updated.after.output
      });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      cases: [...group.cases].sort((a, b) => a.id.localeCompare(b.id))
    }))
    .sort((a, b) => a.catalogId.localeCompare(b.catalogId));
}

function getOrCreateGroup(
  groups: Map<string, CatalogCaseGroup>,
  catalogId: string,
  title: string,
  definitionPath: string
): CatalogCaseGroup {
  const existing = groups.get(catalogId);
  if (existing) {
    if (existing.definitionPath === '(unknown)' && definitionPath !== '(unknown)') {
      existing.definitionPath = definitionPath;
    }
    return existing;
  }
  const created: CatalogCaseGroup = { catalogId, title, definitionPath, cases: [] };
  groups.set(catalogId, created);
  return created;
}

function appendCaseBlocks(lines: string[], testCase: CaseDelta): void {
  if (testCase.changeType === 'UPDATE') {
    lines.push('**before**');
    lines.push('');
    lines.push('input');
    lines.push('```json');
    lines.push(JSON.stringify(testCase.inputBefore, null, 2));
    lines.push('```');
    lines.push('output');
    lines.push('```json');
    lines.push(JSON.stringify(testCase.outputBefore, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('**after**');
    lines.push('');
    lines.push('input');
    lines.push('```json');
    lines.push(JSON.stringify(testCase.inputAfter, null, 2));
    lines.push('```');
    lines.push('output');
    lines.push('```json');
    lines.push(JSON.stringify(testCase.outputAfter, null, 2));
    lines.push('```');
    lines.push('');
    return;
  }

  if (testCase.changeType === 'REMOVE') {
    lines.push('**before**');
    lines.push('');
    lines.push('input');
    lines.push('```json');
    lines.push(JSON.stringify(testCase.inputBefore, null, 2));
    lines.push('```');
    lines.push('output');
    lines.push('```json');
    lines.push(JSON.stringify(testCase.outputBefore, null, 2));
    lines.push('```');
    lines.push('');
    return;
  }

  lines.push('**after**');
  lines.push('');
  lines.push('input');
  lines.push('```json');
  lines.push(JSON.stringify(testCase.inputAfter, null, 2));
  lines.push('```');
  lines.push('output');
  lines.push('```json');
  lines.push(JSON.stringify(testCase.outputAfter, null, 2));
  lines.push('```');
  lines.push('');
}

function renderCatalogHeader(
  lines: string[],
  catalog: DiffCatalog,
  definitionLinks?: DefinitionLinkOptions
): void {
  lines.push(`### ${catalog.catalogId} - ${catalog.title}`);
  if (catalog.kind === 'sql') {
    lines.push(`- definition: ${formatDefinitionMarkdown(catalog.definition, definitionLinks)}`);
    lines.push('- fixtures:');
    for (const tableName of catalog.fixtures ?? []) {
      lines.push(`  - ${tableName}`);
    }
  }
  lines.push('');
}

function renderCase(lines: string[], testCase: DiffCase): void {
  lines.push(`### ${testCase.id} - ${testCase.title}`);
  lines.push('input:');
  lines.push('```json');
  lines.push(JSON.stringify(testCase.input, null, 2));
  lines.push('```');
  lines.push('output:');
  lines.push('```json');
  lines.push(JSON.stringify(testCase.output, null, 2));
  lines.push('```');
  lines.push('');
}

function renderRemovedCase(lines: string[], testCase: DiffCase, detail: RemovedDetailLevel): void {
  lines.push(`### ${testCase.id} - ${testCase.title}`);
  if (detail === 'none') {
    lines.push('');
    return;
  }
  lines.push('input:');
  lines.push('```json');
  lines.push(JSON.stringify(testCase.input, null, 2));
  lines.push('```');
  if (detail === 'full') {
    lines.push('output:');
    lines.push('```json');
    lines.push(JSON.stringify(testCase.output, null, 2));
    lines.push('```');
  }
  lines.push('');
}
