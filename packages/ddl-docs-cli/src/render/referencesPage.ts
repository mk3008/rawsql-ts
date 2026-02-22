import path from 'node:path';
import type { TableDocModel } from '../types';
import { formatCodeCell } from '../utils/markdown';
import type { RenderedPage } from './types';

/**
 * Renders a global foreign key reference index page.
 */
export function renderReferencesPage(outDir: string, tables: TableDocModel[]): RenderedPage {
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# References');
  lines.push('');
  lines.push('[<- Table Index](./index.md)');
  lines.push('');
  lines.push('| From | To | Expression |');
  lines.push('| --- | --- | --- |');

  const rows: Array<{ from: string; to: string; expression: string; fromLink: string; toLink: string }> = [];
  const tableLinkMap = new Map<string, string>();
  for (const table of tables) {
    tableLinkMap.set(`${table.schema}.${table.table}`, `./${table.schemaSlug}/${table.tableSlug}.md`);
  }
  for (const table of tables) {
    for (const reference of table.outgoingReferences) {
      if (reference.source !== 'ddl') {
        continue;
      }
      const expression = reference.expression;
      const to = reference.targetTableKey;
      rows.push({
        from: `${table.schema}.${table.table}`,
        to,
        expression,
        fromLink: `./${table.schemaSlug}/${table.tableSlug}.md`,
        toLink: tableLinkMap.get(to) ?? './index.md',
      });
    }
  }
  rows.sort((a, b) => `${a.from}|${a.to}|${a.expression}`.localeCompare(`${b.from}|${b.to}|${b.expression}`));

  for (const row of rows) {
    lines.push(`| [${row.from}](${row.fromLink}) | [${row.to}](${row.toLink}) | ${formatCodeCell(row.expression)} |`);
  }

  lines.push('');
  return { path: path.join(outDir, 'references.md'), content: lines.join('\n') };
}
