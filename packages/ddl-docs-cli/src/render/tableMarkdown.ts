import path from 'node:path';
import type { ReferenceDocModel, TableDocModel } from '../types';
import { formatCodeCell, formatTableCell } from '../utils/markdown';

interface TableSuggestionSql {
  columnCommentSql: string[];
  foreignKeySql: string[];
}

export function renderTableMarkdown(table: TableDocModel, suggestedSql: TableSuggestionSql): string {
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push(`# ${table.schema}.${table.table}`);
  lines.push('');
  lines.push('[<- All Schemas](../index.md) | [Table Index](./index.md)');
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(`- Comment: ${formatTableCell(table.tableComment)}`);
  lines.push(`- Source Files: ${formatTableCell(table.sourceFiles.map((entry) => `\`${entry}\``).join('<br>'))}`);
  lines.push('');
  lines.push('## Columns');
  lines.push('');
  lines.push('| Key | Column | Type | Nullable | Default | Comment | Usages |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');

  for (const column of table.columns) {
    lines.push(
      `| ${column.isPrimaryKey ? 'PK' : ''} | ${formatCodeCell(column.name)} | ${formatCodeCell(column.typeName)} | ${column.nullable ? 'YES' : 'NO'} | ${formatCodeCell(column.defaultValue)} | ${formatTableCell(column.comment)} | [See usages](./columns/${column.conceptSlug}.md) |`
    );
  }

  lines.push('');
  lines.push('## Constraints');
  lines.push('');
  const nonKeyConstraints = table.constraints.filter((constraint) => constraint.kind !== 'PK' && constraint.kind !== 'FK');
  if (nonKeyConstraints.length === 0) {
    lines.push('- None');
  } else {
    lines.push('| Kind | Name | Expression |');
    lines.push('| --- | --- | --- |');
    for (const constraint of nonKeyConstraints) {
      lines.push(`| ${constraint.kind} | ${formatCodeCell(constraint.name)} | ${formatTableCell(constraint.expression)} |`);
    }
  }

  lines.push('');
  lines.push('## References');
  lines.push('');
  lines.push('### DDL');
  lines.push('');
  const ddlReferences = mergeAndSortReferences(
    table.outgoingReferences.filter((reference) => reference.source === 'ddl'),
    table.incomingReferences.filter((reference) => reference.source === 'ddl')
  );
  if (ddlReferences.length === 0) {
    lines.push('- None');
  } else {
    lines.push(...renderReferenceTable(ddlReferences, table, 'ddl'));
  }

  lines.push('');
  lines.push('### Suggest');
  lines.push('');
  const suggestedReferences = mergeAndSortReferences(
    table.outgoingReferences.filter((reference) => reference.source === 'suggested'),
    table.incomingReferences.filter((reference) => reference.source === 'suggested')
  );
  if (suggestedReferences.length === 0) {
    lines.push('- None');
  } else {
    lines.push(...renderReferenceTable(suggestedReferences, table, 'suggest'));
  }

  lines.push('');
  lines.push('## Appendix');
  lines.push('');
  lines.push('### Normalized SQL');
  lines.push('');
  lines.push('```sql');
  lines.push(table.normalizedSql);
  lines.push('```');

  if (suggestedSql.columnCommentSql.length > 0) {
    lines.push('');
    lines.push('### Suggested Column Comment SQL (Optional)');
    lines.push('');
    lines.push('```sql');
    lines.push('-- suggested: v1 (not applied)');
    lines.push(...suggestedSql.columnCommentSql);
    lines.push('```');
  }

  if (suggestedSql.foreignKeySql.length > 0) {
    lines.push('');
    lines.push('### Suggested Foreign Key Constraint SQL (Optional)');
    lines.push('');
    lines.push('```sql');
    lines.push('-- suggested: v1 (not applied)');
    lines.push(...suggestedSql.foreignKeySql);
    lines.push('```');
  }

  lines.push('');
  return lines.join('\n');
}

export function tableDocPath(outDir: string, schemaSlug: string, tableSlug: string): string {
  return path.join(outDir, schemaSlug, `${tableSlug}.md`);
}

function linkFromTablePage(current: TableDocModel, targetSchemaSlug: string, targetTableSlug: string): string {
  if (current.schemaSlug === targetSchemaSlug) {
    return `./${targetTableSlug}.md`;
  }
  return `../${targetSchemaSlug}/${targetTableSlug}.md`;
}

function renderReferenceTable(
  references: ReferenceDocModel[],
  table: TableDocModel,
  mode: 'ddl' | 'suggest'
): string[] {
  const lines: string[] = [];
  if (mode === 'ddl') {
    lines.push('| From | To | Columns | On Delete | On Update |');
    lines.push('| --- | --- | --- | --- | --- |');
  } else {
    lines.push('| From | To | Columns | Match |');
    lines.push('| --- | --- | --- | --- |');
  }
  for (const reference of references) {
    const fromCell = renderFromCell(reference, table);
    const toCell = renderToCell(reference, table);
    const columnsCell = formatCodeCell(`${reference.fromColumns.join(', ')} -> ${reference.targetColumns.join(', ') || '?'}`);
    const matchCell = reference.matchRule ? formatCodeCell(reference.matchRule) : '-';
    const onDeleteCell = formatCodeCell(reference.onDeleteAction ?? 'none');
    const onUpdateCell = formatCodeCell(reference.onUpdateAction ?? 'none');
    if (mode === 'ddl') {
      lines.push(`| ${fromCell} | ${toCell} | ${columnsCell} | ${onDeleteCell} | ${onUpdateCell} |`);
    } else {
      lines.push(`| ${fromCell} | ${toCell} | ${columnsCell} | ${matchCell} |`);
    }
  }
  return lines;
}

function renderFromCell(reference: ReferenceDocModel, table: TableDocModel): string {
  if (reference.direction === 'outgoing') {
    return formatCodeCell(reference.fromTableKey);
  }
  const linkPath = linkFromTablePage(table, reference.fromSchemaSlug, reference.fromTableSlug);
  return `[${reference.fromTableKey}](${linkPath})`;
}

function renderToCell(reference: ReferenceDocModel, table: TableDocModel): string {
  if (reference.direction === 'incoming') {
    return formatCodeCell(reference.targetTableKey);
  }
  const linkPath = linkFromTablePage(table, reference.targetSchemaSlug, reference.targetTableSlug);
  return `[${reference.targetTableKey}](${linkPath})`;
}

function mergeAndSortReferences(outgoing: ReferenceDocModel[], incoming: ReferenceDocModel[]): ReferenceDocModel[] {
  return [...outgoing, ...incoming].sort((a, b) => {
    const left = `${a.direction}|${a.fromTableKey}|${a.targetTableKey}|${a.fromColumns.join(',')}|${a.targetColumns.join(',')}|${a.matchRule ?? ''}|${a.onDeleteAction ?? ''}|${a.onUpdateAction ?? ''}`;
    const right = `${b.direction}|${b.fromTableKey}|${b.targetTableKey}|${b.fromColumns.join(',')}|${b.targetColumns.join(',')}|${b.matchRule ?? ''}|${b.onDeleteAction ?? ''}|${b.onUpdateAction ?? ''}`;
    return left.localeCompare(right);
  });
}
