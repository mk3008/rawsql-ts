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

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`- schemaVersion: ${model.schemaVersion}`);
  lines.push(`- catalogs: ${model.totals.catalogs}`);
  lines.push('');

  for (const catalog of model.catalogs) {
    lines.push(`## ${catalog.catalogId} - ${catalog.title}`);
    lines.push(`- definition: ${formatDefinitionMarkdown(catalog.definition, definitionLinks)}`);
    if (catalog.description) {
      lines.push(`- description: ${catalog.description}`);
    }
    lines.push(`- tests: ${catalog.cases.length}`);
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
