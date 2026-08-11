import type { LineageColumn } from '../domain/lineage';

const sqlIdentifierPattern = String.raw`(?:"[^"]+"|` + '`[^`]+`' + String.raw`|\[[^\]]+\]|[A-Za-z_][\w$]*)`;
const simpleColumnReferencePattern = new RegExp(String.raw`^\s*${sqlIdentifierPattern}(?:\s*\.\s*${sqlIdentifierPattern})?\s*;?\s*$`);
const literalKeywords = new Set(['false', 'null', 'true']);

export function hasColumnCalloutContent(column: LineageColumn) {
  if (column.comments?.length) {
    return true;
  }
  if (column.usage?.role === 'condition' || column.usage?.role === 'filter') {
    return true;
  }
  return Boolean(column.expressionSql && !isSimpleColumnReference(column.expressionSql));
}

export function isPassthroughColumn(column: LineageColumn) {
  return Boolean(!column.usage && column.expressionSql && !column.comments?.length && isSimpleColumnReference(column.expressionSql));
}

export function isVisibleGraphColumn(column: LineageColumn) {
  if (column.usage?.role === 'condition' || column.usage?.role === 'filter' || column.usage?.role === 'unused') {
    return false;
  }
  return true;
}

export function isSimpleColumnReference(sql: string) {
  const trimmedSql = sql.trim().replace(/;$/, '').trim();
  if (literalKeywords.has(trimmedSql.toLowerCase())) {
    return false;
  }
  return simpleColumnReferencePattern.test(trimmedSql);
}
