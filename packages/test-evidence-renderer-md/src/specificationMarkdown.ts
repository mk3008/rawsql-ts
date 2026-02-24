import { SpecificationModel } from '@rawsql-ts/test-evidence-core';
import { DefinitionLinkOptions, formatDefinitionMarkdown } from './definitionLink';

export type SpecificationMarkdownOptions = {
  includeFixtures?: boolean;
  definitionLinks?: DefinitionLinkOptions;
  title?: string;
};

/**
 * Render markdown for a pure specification model.
 * Presentation options only affect markdown shape and never semantic transforms.
 */
export function renderSpecificationMarkdown(
  model: SpecificationModel,
  options?: SpecificationMarkdownOptions
): string {
  const includeFixtures = options?.includeFixtures ?? true;
  const definitionLinks = options?.definitionLinks;
  const title = options?.title ?? 'Test Evidence Specification';
  const lines: string[] = [];

  for (const catalog of model.catalogs) {
    lines.push(`# ${catalog.catalogId} Test Cases`);
    lines.push('');
    lines.push(`- schemaVersion: ${model.schemaVersion}`);
    lines.push(`- title: ${catalog.title}`);
    lines.push(`- definition: ${formatDefinitionMarkdown(catalog.definition, definitionLinks)}`);
    if (catalog.description) {
      lines.push(`- description: ${catalog.description}`);
    }
    if (Array.isArray(catalog.refs) && catalog.refs.length > 0) {
      lines.push('- refs:');
      for (const ref of catalog.refs) {
        lines.push(`  - [${ref.label}](${ref.url})`);
      }
    }
    lines.push(`- tests: ${catalog.cases.length}`);
    if (catalog.kind === 'sql' && includeFixtures) {
      lines.push(`- fixtures: ${(catalog.fixtures ?? []).join(', ') || '(none)'}`);
    }
    lines.push('');

    for (const testCase of [...catalog.cases].sort((a, b) => a.id.localeCompare(b.id))) {
      lines.push(`## ${testCase.id} - ${testCase.title}`);
      lines.push(`- expected: ${testCase.expected}`);
      lines.push(`- tags: ${formatCaseTags(testCase.tags)}`);
      lines.push(`- focus: ${formatCaseFocus(testCase.focus)}`);
      if (Array.isArray(testCase.refs) && testCase.refs.length > 0) {
        lines.push('- refs:');
        for (const ref of testCase.refs) {
          lines.push(`  - [${ref.label}](${ref.url})`);
        }
      }
      lines.push('### input');
      lines.push('```json');
      lines.push(stringifyStablePretty(testCase.input));
      lines.push('```');
      if (testCase.expected === 'throws') {
        lines.push('### error');
        lines.push('```json');
        lines.push(stringifyErrorPretty(testCase.error));
        lines.push('```');
      } else {
        lines.push('### output');
        lines.push('```json');
        lines.push(stringifyStablePretty(testCase.output));
        lines.push('```');
      }
      lines.push('');
    }
    lines.push('');
  }

  if (lines[0] === undefined) {
    return `# ${title}\n\n- schemaVersion: ${model.schemaVersion}\n- catalogs: ${model.totals.catalogs}\n`;
  }
  return lines.join('\n').trimEnd();
}

function stringifyStablePretty(value: unknown): string {
  return JSON.stringify(sortDeep(value), null, 2) ?? 'null';
}

function stringifyErrorPretty(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return 'null';
  }
  const source = value as Record<string, unknown>;
  return JSON.stringify(
    {
      name: source.name,
      message: source.message,
      match: source.match
    },
    null,
    2
  ) ?? 'null';
}

function formatCaseTags(tags: string[] | undefined): string {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '[]';
  }
  return `[${tags.join(', ')}]`;
}

function formatCaseFocus(focus: string | undefined): string {
  if (typeof focus === 'string' && focus.trim().length > 0) {
    return focus.trim();
  }
  return '(not specified)';
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortDeep(item));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, nested]) => [key, sortDeep(nested)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}
