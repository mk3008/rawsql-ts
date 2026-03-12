import { SpecificationModel, type DiffCase, type DiffCatalog } from '@rawsql-ts/test-evidence-core';
import { DefinitionLinkOptions, formatDefinitionMarkdown } from './definitionLink';

export type TestDocumentationMarkdownOptions = {
  definitionLinks?: DefinitionLinkOptions;
  title?: string;
};

/**
 * Render human-readable test documentation from the deterministic specification model.
 * This projection is presentation-only and must never mutate or reinterpret the semantic model.
 */
export function renderTestDocumentationMarkdown(
  model: SpecificationModel,
  options?: TestDocumentationMarkdownOptions
): string {
  const definitionLinks = options?.definitionLinks;
  const title = options?.title ?? 'ZTD Test Documentation';
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`- schemaVersion: ${model.schemaVersion}`);
  lines.push(`- catalogs: ${model.totals.catalogs}`);
  lines.push(`- functionCatalogs: ${model.totals.functionCatalogs}`);
  lines.push(`- sqlCatalogs: ${model.totals.sqlCatalogs}`);
  lines.push(`- tests: ${model.totals.tests}`);
  lines.push('');

  for (const catalog of [...model.catalogs].sort((a, b) => a.catalogId.localeCompare(b.catalogId))) {
    lines.push(`## ${catalog.catalogId} - ${catalog.title}`);
    lines.push(`- targetType: ${catalog.kind === 'sql' ? 'sql-catalog' : 'function-unit'}`);
    lines.push(`- targetName: ${catalog.title}`);
    lines.push(`- definition: ${formatDefinitionMarkdown(catalog.definition ?? '(unknown)', definitionLinks)}`);
    lines.push(`- purpose: ${catalog.description ?? formatCatalogPurpose(catalog)}`);
    lines.push(`- tests: ${catalog.cases.length}`);
    if (catalog.kind === 'sql') {
      lines.push(`- fixtures: ${(catalog.fixtures ?? []).join(', ') || '(none)'}`);
    }
    if (Array.isArray(catalog.refs) && catalog.refs.length > 0) {
      lines.push('- refs:');
      for (const ref of catalog.refs) {
        lines.push(`  - [${ref.label}](${ref.url})`);
      }
    }
    lines.push('');
    lines.push('### Test Case List');
    for (const testCase of [...catalog.cases].sort((a, b) => a.id.localeCompare(b.id))) {
      lines.push(`- ${testCase.id}: ${testCase.title}`);
    }
    lines.push('');

    for (const testCase of [...catalog.cases].sort((a, b) => a.id.localeCompare(b.id))) {
      lines.push(`### ${testCase.id} - ${testCase.title}`);
      lines.push(`- purpose: ${formatCasePurpose(testCase)}`);
      lines.push(`- execution: ${formatExecutionSummary(catalog, testCase)}`);
      lines.push(`- expectedSummary: ${formatExpectedSummary(testCase)}`);
      lines.push(`- coverage: ${formatCoveragePerspective(testCase)}`);
      if (Array.isArray(testCase.refs) && testCase.refs.length > 0) {
        lines.push('- refs:');
        for (const ref of testCase.refs) {
          lines.push(`  - [${ref.label}](${ref.url})`);
        }
      }
      lines.push('#### Input / Setup');
      if (catalog.kind === 'sql') {
        lines.push(`- fixtures: ${(catalog.fixtures ?? []).join(', ') || '(none)'}`);
      }
      lines.push('```json');
      lines.push(stringifyStablePretty(testCase.input));
      lines.push('```');
      lines.push('#### Expected Result');
      if (testCase.expected === 'throws') {
        lines.push('```json');
        lines.push(stringifyErrorPretty(testCase.error));
        lines.push('```');
      } else {
        lines.push('```json');
        lines.push(stringifyStablePretty(testCase.output));
        lines.push('```');
      }
      lines.push('#### Notes / Assumptions');
      lines.push(`- ${formatCaseNotes(testCase)}`);
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd();
}

function formatCatalogPurpose(catalog: DiffCatalog): string {
  if (catalog.kind === 'sql') {
    return 'Executable SQL catalog coverage projected from deterministic ZTD test assets.';
  }
  return 'Executable unit-test coverage projected from deterministic ZTD test assets.';
}

function formatCasePurpose(testCase: DiffCase): string {
  if (typeof testCase.focus === 'string' && testCase.focus.trim().length > 0) {
    return testCase.focus.trim();
  }
  return testCase.title;
}

function formatExecutionSummary(catalog: DiffCatalog, testCase: DiffCase): string {
  if (catalog.kind === 'sql') {
    const fixtures = (catalog.fixtures ?? []).join(', ') || 'no fixtures';
    return `Execute the SQL catalog with the documented parameters against fixtures: ${fixtures}.`;
  }
  if (testCase.expected === 'throws') {
    return 'Execute the target unit with the arranged input and capture the thrown error contract.';
  }
  return 'Execute the target unit with the arranged input and compare the returned value.';
}

function formatExpectedSummary(testCase: DiffCase): string {
  if (testCase.expected === 'throws') {
    const name = testCase.error?.name ?? 'Error';
    const message = testCase.error?.message ?? '(message unspecified)';
    const match = testCase.error?.match ?? 'contains';
    return `Throws ${name}; message ${match} \"${message}\".`;
  }
  if (Array.isArray(testCase.output)) {
    return `Returns ${testCase.output.length} row(s).`;
  }
  return `Returns ${summarizeScalarOutput(testCase.output)}.`;
}

function summarizeScalarOutput(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `${value.length} item(s)`;
  }
  if (typeof value === 'object') {
    return 'an object value';
  }
  return JSON.stringify(value) ?? 'an unspecified value';
}

function formatCoveragePerspective(testCase: DiffCase): string {
  const classification = classifyCoveragePerspective(testCase);
  const tags = Array.isArray(testCase.tags) && testCase.tags.length > 0
    ? `[${testCase.tags.join(', ')}]`
    : '[]';
  return `${classification}; tags=${tags}`;
}

function classifyCoveragePerspective(testCase: DiffCase): 'normal' | 'edge' | 'regression' | 'unspecified' {
  const tags = new Set((testCase.tags ?? []).map((tag) => tag.toLowerCase()));
  const text = `${testCase.id} ${testCase.title} ${testCase.focus ?? ''}`.toLowerCase();

  if (text.includes('regression') || text.includes('bugfix') || text.includes('hotfix') || text.includes('issue')) {
    return 'regression';
  }
  if (testCase.expected === 'throws' || tags.has('bva') || text.includes('boundary') || text.includes('edge')) {
    return 'edge';
  }
  if (
    text.includes('baseline') ||
    text.includes('smoke') ||
    text.includes('noop') ||
    text.includes('normal') ||
    tags.size > 0
  ) {
    return 'normal';
  }
  return 'unspecified';
}

function formatCaseNotes(testCase: DiffCase): string {
  if (Array.isArray(testCase.refs) && testCase.refs.length > 0) {
    return 'See refs for linked issue or design context.';
  }
  if (testCase.expected === 'throws') {
    return 'Error matching remains part of the executable contract.';
  }
  return 'No extra assumptions were exported for this case.';
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
      match: source.match,
    },
    null,
    2
  ) ?? 'null';
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
