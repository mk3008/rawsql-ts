import path from 'node:path';
import type { ReferenceDocModel, TableDocModel } from '../types';
import { formatCodeCell, formatTableCell } from '../utils/markdown';

/**
 * Suggested SQL statements grouped by table.
 */
export interface TableSuggestionSql {
  /**
   * COMMENT ON COLUMN suggestions for missing column comments.
   */
  columnCommentSql: string[];
  /**
   * ALTER TABLE ... ADD FOREIGN KEY suggestions.
   */
  foreignKeySql: string[];
}

export interface RenderTableOptions {
  labelSeparator?: string;
}

/**
 * Renders a single table definition markdown page.
 */
export function renderTableMarkdown(table: TableDocModel, suggestedSql: TableSuggestionSql, renderOptions?: RenderTableOptions): string {
  const labelSeparator = renderOptions?.labelSeparator;
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push(`# ${table.schema}.${table.table}`);
  lines.push('');
  lines.push('[<- All Schemas](../index.md) | [Table Index](./index.md)');
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(`- Instance: ${formatTableCell(table.instance || '-')}`);
  lines.push(`- Comment: ${formatTableCell(table.tableComment)}`);
  lines.push(`- Source Files: ${formatTableCell(table.sourceFiles.map((entry) => `\`${entry}\``).join('<br>'))}`);
  lines.push('');
  lines.push('## Columns');
  lines.push('');
  if (labelSeparator) {
    lines.push('| Key | Label | Column | Type | Nullable | Default | Seq | Comment | Usages |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  } else {
    lines.push('| Key | Column | Type | Nullable | Default | Seq | Comment | Usages |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  }

  for (const column of table.columns) {
    lines.push(renderColumnRow(column, labelSeparator));
  }

  lines.push('');
  lines.push('## Indexes & Constraints');
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
  const outgoingAll = sortDirectionalReferences([...table.outgoingReferences]);
  const incomingAll = sortDirectionalReferences([...table.incomingReferences]);
  if (outgoingAll.length === 0 && incomingAll.length === 0) {
    lines.push('- None');
  } else {
    if (outgoingAll.length > 0) {
      lines.push(`::: details To (outgoing): ${outgoingAll.length}`);
      lines.push('');
      lines.push(...renderUnifiedReferenceTable(outgoingAll, table));
      lines.push('');
      lines.push(':::');
      lines.push('');
    }
    if (incomingAll.length > 0) {
      lines.push(`::: details From (incoming): ${incomingAll.length}`);
      lines.push('');
      lines.push(...renderUnifiedReferenceTable(incomingAll, table));
      lines.push('');
      lines.push(':::');
      lines.push('');
    }
  }

  lines.push('');
  lines.push('## Triggers');
  lines.push('');
  if (table.triggers.length === 0) {
    lines.push('- None');
  } else {
    lines.push('| Name | Timing | Events | For Each | Function |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const trigger of table.triggers) {
      const nameCell = formatCodeCell(trigger.name);
      const eventsCell = trigger.events.join(', ');
      const funcCell = formatCodeCell(trigger.functionName);
      lines.push(`| ${nameCell} | ${trigger.timing} | ${eventsCell} | ${trigger.forEach} | ${funcCell} |`);
    }
  }

  lines.push('');
  lines.push('## Appendix');
  lines.push('');
  lines.push('::: details Definition');
  lines.push('');
  lines.push('```sql');
  lines.push(table.normalizedSql.definition);
  lines.push('```');
  lines.push('');
  lines.push(':::');

  if (table.normalizedSql.comments) {
    lines.push('');
    lines.push('::: details Comments');
    lines.push('');
    lines.push('```sql');
    lines.push(table.normalizedSql.comments);
    lines.push('```');
    lines.push('');
    lines.push(':::');
  }

  if (table.normalizedSql.triggers) {
    lines.push('');
    lines.push('::: details Triggers (raw)');
    lines.push('');
    lines.push('```sql');
    lines.push(table.normalizedSql.triggers);
    lines.push('```');
    lines.push('');
    lines.push(':::');
  }

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

/**
 * Returns output path for a rendered table markdown page.
 */
export function tableDocPath(outDir: string, schemaSlug: string, tableSlug: string): string {
  return path.join(outDir, schemaSlug, `${tableSlug}.md`);
}

function linkFromTablePage(current: TableDocModel, targetSchemaSlug: string, targetTableSlug: string): string {
  if (current.schemaSlug === targetSchemaSlug) {
    return `./${targetTableSlug}.md`;
  }
  return `../${targetSchemaSlug}/${targetTableSlug}.md`;
}

const SERIAL_TYPES = new Set(['serial', 'bigserial', 'smallserial']);

function isSequenceColumn(column: TableDocModel['columns'][number]): boolean {
  return SERIAL_TYPES.has(column.typeName.toLowerCase()) || column.defaultValue.toLowerCase().includes('nextval(');
}

function splitComment(comment: string, separator: string): { label: string; description: string } {
  const regex = new RegExp(separator);
  const match = regex.exec(comment);
  if (match !== null) {
    return {
      label: comment.slice(0, match.index).trim(),
      description: comment.slice(match.index + match[0].length).trim(),
    };
  }
  return { label: comment, description: '' };
}

function renderColumnRow(column: TableDocModel['columns'][number], labelSeparator: string | undefined): string {
  const keyCell = column.isPrimaryKey ? 'PK' : '';
  const nameCell = formatCodeCell(column.name);
  const typeCell = formatCodeCell(column.typeName);
  const nullableCell = column.nullable ? 'YES' : 'NO';
  const defaultCell = formatCodeCell(column.defaultValue);
  const seqCell = isSequenceColumn(column) ? 'YES' : '';
  const usagesCell = `[usages](./columns/${column.conceptSlug}.md)`;
  if (labelSeparator) {
    const { label, description } = splitComment(column.comment, labelSeparator);
    const labelCell = formatTableCell(label);
    const commentCell = formatTableCell(description);
    return `| ${keyCell} | ${labelCell} | ${nameCell} | ${typeCell} | ${nullableCell} | ${defaultCell} | ${seqCell} | ${commentCell} | ${usagesCell} |`;
  }
  const commentCell = formatTableCell(column.comment);
  return `| ${keyCell} | ${nameCell} | ${typeCell} | ${nullableCell} | ${defaultCell} | ${seqCell} | ${commentCell} | ${usagesCell} |`;
}

function renderUnifiedReferenceTable(references: ReferenceDocModel[], table: TableDocModel): string[] {
  const lines: string[] = [];
  lines.push('| Source | Table | Comment | Columns | On Delete | On Update | Match |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const reference of references) {
    const sourceCell = formatCodeCell(reference.source);
    const otherTableCell = renderOtherTableCell(reference, table);
    const otherComment = reference.direction === 'outgoing' ? reference.targetTableComment : reference.fromTableComment;
    const commentCell = formatTableCell(otherComment);
    const columnsCell = formatCodeCell(
      `${reference.fromColumns.join(', ') || '?'} -> ${reference.targetColumns.join(', ') || '?'}`
    );
    const onDeleteCell = reference.source === 'ddl' ? formatCodeCell(reference.onDeleteAction ?? 'none') : '-';
    const onUpdateCell = reference.source === 'ddl' ? formatCodeCell(reference.onUpdateAction ?? 'none') : '-';
    const matchCell = reference.source === 'suggested' && reference.matchRule ? formatCodeCell(reference.matchRule) : '-';
    lines.push(`| ${sourceCell} | ${otherTableCell} | ${commentCell} | ${columnsCell} | ${onDeleteCell} | ${onUpdateCell} | ${matchCell} |`);
  }
  return lines;
}

function renderOtherTableCell(reference: ReferenceDocModel, table: TableDocModel): string {
  if (reference.direction === 'outgoing') {
    const linkPath = linkFromTablePage(table, reference.targetSchemaSlug, reference.targetTableSlug);
    return `[${reference.targetTableKey}](${linkPath})`;
  }
  const linkPath = linkFromTablePage(table, reference.fromSchemaSlug, reference.fromTableSlug);
  return `[${reference.fromTableKey}](${linkPath})`;
}

function sortDirectionalReferences(references: ReferenceDocModel[]): ReferenceDocModel[] {
  return references.sort((left, right) => {
    const leftOther = left.direction === 'outgoing' ? left.targetTableKey : left.fromTableKey;
    const rightOther = right.direction === 'outgoing' ? right.targetTableKey : right.fromTableKey;
    const leftComment = left.direction === 'outgoing' ? left.targetTableComment : left.fromTableComment;
    const rightComment = right.direction === 'outgoing' ? right.targetTableComment : right.fromTableComment;
    return `${left.source}|${leftOther}|${leftComment}|${left.expression}`.localeCompare(
      `${right.source}|${rightOther}|${rightComment}|${right.expression}`
    );
  });
}
