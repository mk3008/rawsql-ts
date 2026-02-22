import path from 'node:path';
import type { FindingItem, TableDocModel } from '../types';
import { formatTableCell } from '../utils/markdown';

export interface RenderedPage {
  path: string;
  content: string;
}

export function renderIndexPages(
  outDir: string,
  tables: TableDocModel[],
  findings: FindingItem[],
  tableSuggestSet: Set<string>
): RenderedPage[] {
  const pages: RenderedPage[] = [];
  const grouped = groupBySchema(tables);
  const tableAlertSet = collectTableAlerts(tables, findings);

  pages.push({
    path: path.join(outDir, 'index.md'),
    content: renderGlobalIndex(grouped),
  });

  for (const [schema, schemaTables] of grouped.entries()) {
    const schemaSlug = schemaTables[0]?.schemaSlug ?? schema;
    pages.push({
      path: path.join(outDir, schemaSlug, 'index.md'),
      content: renderSchemaIndex(schema, schemaTables, tableAlertSet, tableSuggestSet),
    });
  }

  return pages;
}

function renderGlobalIndex(grouped: Map<string, TableDocModel[]>): string {
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# Schema Index');
  lines.push('');
  lines.push('- [References](./references.md)');
  lines.push('- [Column Index (Alerts)](./columns/index.md)');
  lines.push('');
  lines.push('## Schemas');
  lines.push('');
  lines.push('| Schema | Tables |');
  lines.push('| --- | --- |');

  for (const [schema, tables] of grouped.entries()) {
    const schemaSlug = tables[0]?.schemaSlug ?? schema;
    lines.push(`| [${schema}](./${schemaSlug}/index.md) | ${tables.length} |`);
  }

  lines.push('');
  return lines.join('\n');
}

function renderSchemaIndex(
  schema: string,
  tables: TableDocModel[],
  tableAlertSet: Set<string>,
  tableSuggestSet: Set<string>
): string {
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push(`# ${schema} Tables`);
  lines.push('');
  lines.push('[<- All Schemas](../index.md)');
  lines.push('- [Column Index](./columns/index.md)');
  lines.push('');
  lines.push('| Table | Columns | Comment | Alert | Suggest |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const table of tables) {
    const tableKey = `${table.schema}.${table.table}`;
    const suggestMark = tableSuggestSet.has(tableKey) ? 'SUGGEST' : '';
    const alertMark = tableAlertSet.has(tableKey) ? 'ALERT' : '';
    lines.push(
      `| [${table.table}](./${table.tableSlug}.md) | ${table.columns.length} | ${formatTableCell(table.tableComment)} | ${alertMark} | ${suggestMark} |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function groupBySchema(tables: TableDocModel[]): Map<string, TableDocModel[]> {
  const grouped = new Map<string, TableDocModel[]>();
  for (const table of tables) {
    const bucket = grouped.get(table.schema) ?? [];
    bucket.push(table);
    grouped.set(table.schema, bucket);
  }

  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => {
      const left = `${a.table}|${a.tableSlug}`;
      const right = `${b.table}|${b.tableSlug}`;
      return left.localeCompare(right);
    });
  }

  return new Map(Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right)));
}

function collectTableAlerts(tables: TableDocModel[], findings: FindingItem[]): Set<string> {
  const direct = new Set<string>();
  const conceptAlerts = new Set<string>();

  for (const finding of findings) {
    if (finding.scope.schema && finding.scope.table) {
      direct.add(`${finding.scope.schema}.${finding.scope.table}`);
    }
    if (finding.scope.concept) {
      conceptAlerts.add(finding.scope.concept);
    }
  }

  if (conceptAlerts.size === 0) {
    return direct;
  }

  const result = new Set<string>(direct);
  for (const table of tables) {
    if (table.columns.some((column) => conceptAlerts.has(column.concept))) {
      result.add(`${table.schema}.${table.table}`);
    }
  }
  return result;
}
