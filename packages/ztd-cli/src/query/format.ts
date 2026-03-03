import type { QueryUsageMatch, QueryUsageReport, QueryUsageWarning } from './types';

/**
 * Sort matches in a deterministic, machine-friendly order.
 */
export function sortQueryUsageMatches(matches: QueryUsageMatch[]): QueryUsageMatch[] {
  return [...matches].sort((a, b) =>
    a.catalog_id.localeCompare(b.catalog_id) ||
    a.sql_file.localeCompare(b.sql_file) ||
    compareNullableNumber(a.location?.fileOffsetStart, b.location?.fileOffsetStart) ||
    a.query_id.localeCompare(b.query_id) ||
    a.usage_kind.localeCompare(b.usage_kind)
  );
}

/**
 * Sort warnings in a deterministic order.
 */
export function sortQueryUsageWarnings(warnings: QueryUsageWarning[]): QueryUsageWarning[] {
  return [...warnings].sort((a, b) =>
    (a.catalog_id ?? '').localeCompare(b.catalog_id ?? '') ||
    (a.query_id ?? '').localeCompare(b.query_id ?? '') ||
    (a.sql_file ?? '').localeCompare(b.sql_file ?? '') ||
    a.code.localeCompare(b.code) ||
    a.message.localeCompare(b.message)
  );
}

/**
 * Format query usage output for text or JSON output.
 */
export function formatQueryUsageReport(report: QueryUsageReport, format: 'text' | 'json'): string {
  if (format === 'json') {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  const lines: string[] = [
    `mode: ${report.mode}`,
    `target: ${report.target.kind} ${report.target.raw}`,
    `catalogs: ${report.summary.catalogsScanned}`,
    `statements: ${report.summary.statementsScanned}`,
    `matches: ${report.summary.matches}`,
    `fallback matches: ${report.summary.fallbackMatches}`,
    `parse warnings: ${report.summary.parseWarnings}`,
    `unresolved sql files: ${report.summary.unresolvedSqlFiles}`
  ];

  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of report.warnings) {
      lines.push(`- [${warning.code}] ${(warning.catalog_id ?? '-')} ${(warning.query_id ?? '-')} ${(warning.sql_file ?? '-')}`);
      lines.push(`  ${warning.message}`);
    }
  }

  const primary = report.matches.filter((match) => match.source === 'ast');
  const fallback = report.matches.filter((match) => match.source === 'fallback');
  lines.push('', 'Primary matches:');
  appendMatches(lines, primary);
  lines.push('', 'Fallback-derived matches:');
  appendMatches(lines, fallback);
  return `${lines.join('\n')}\n`;
}

function appendMatches(lines: string[], matches: QueryUsageMatch[]): void {
  if (matches.length === 0) {
    lines.push('(none)');
    return;
  }

  for (const match of matches) {
    lines.push(`- ${match.catalog_id} ${match.query_id} ${match.usage_kind} ${match.confidence}`);
    lines.push(`  sql_file: ${match.sql_file}`);
    lines.push(`  statement_fingerprint: ${match.statement_fingerprint}`);
    lines.push(`  source: ${match.source}`);
    lines.push(`  snippet: ${match.snippet}`);
    lines.push(`  notes: ${match.notes.length > 0 ? match.notes.join(', ') : '(none)'}`);
    lines.push(`  exprHints: ${match.exprHints && match.exprHints.length > 0 ? match.exprHints.join(', ') : '(none)'}`);
    lines.push(`  location: ${formatLocation(match)}`);
  }
}

function formatLocation(match: QueryUsageMatch): string {
  if (!match.location) {
    return '(unresolved)';
  }
  return `${match.location.startLine}:${match.location.startColumn}-${match.location.endLine}:${match.location.endColumn} @ ${match.location.fileOffsetStart}-${match.location.fileOffsetEnd}`;
}

function compareNullableNumber(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) {
    return 0;
  }
  if (left === undefined) {
    return 1;
  }
  if (right === undefined) {
    return -1;
  }
  return left - right;
}
