import { SpecificationModel } from '@rawsql-ts/test-evidence-core';

export type SpecificationMarkdownOptions = {
  includeFixtures?: boolean;
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
  const lines: string[] = [];

  lines.push('# Test Evidence Specification');
  lines.push('');
  lines.push(`- schemaVersion: ${model.schemaVersion}`);
  lines.push(`- catalogs: ${model.totals.catalogs}`);
  lines.push(`- sqlCatalogs: ${model.totals.sqlCatalogs}`);
  lines.push(`- functionCatalogs: ${model.totals.functionCatalogs}`);
  lines.push(`- tests: ${model.totals.tests}`);
  lines.push('');

  for (const catalog of model.catalogs) {
    lines.push(`## ${catalog.catalogId} - ${catalog.title}`);
    lines.push(`- kind: ${catalog.kind}`);
    lines.push(`- definition: ${catalog.definition ? `\`${catalog.definition}\`` : '(unknown)'}`);
    if (catalog.kind === 'sql' && includeFixtures) {
      lines.push(`- fixtures: ${(catalog.fixtures ?? []).join(', ') || '(none)'}`);
    }
    lines.push('');

    for (const testCase of catalog.cases) {
      lines.push(`### ${testCase.id} - ${testCase.title}`);
      lines.push('#### input');
      lines.push('```json');
      lines.push(JSON.stringify(testCase.input, null, 2));
      lines.push('```');
      lines.push('#### output');
      lines.push('```json');
      lines.push(JSON.stringify(testCase.output, null, 2));
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}
