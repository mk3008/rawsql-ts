import type { QueryUsageMatch, QueryUsageMatchDetail, QueryUsageMatchImpact, QueryUsageReport, QueryUsageWarning } from './types';

/**
 * Sort matches in a deterministic, machine-friendly order.
 */
export function sortQueryUsageMatches(matches: QueryUsageMatch[]): QueryUsageMatch[] {
  return [...matches].sort((a, b) =>
    a.catalog_id.localeCompare(b.catalog_id) ||
    a.sql_file.localeCompare(b.sql_file) ||
    compareNullableNumber(getLocationStart(a), getLocationStart(b)) ||
    a.query_id.localeCompare(b.query_id) ||
    compareUsageKey(a).localeCompare(compareUsageKey(b))
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
    `view: ${report.view}`,
    `target: ${report.target.kind} ${report.target.raw}`,
    `catalogs: ${report.summary.catalogsScanned}`,
    `statements: ${report.summary.statementsScanned}`,
    `matches: ${report.summary.matches}`,
    `fallback matches: ${report.summary.fallbackMatches}`,
    `parse warnings: ${report.summary.parseWarnings}`,
    `unresolved sql files: ${report.summary.unresolvedSqlFiles}`
  ];

  if (report.display) {
    lines.push(`returned matches: ${report.display.returnedMatches}`);
    lines.push(`returned warnings: ${report.display.returnedWarnings}`);
    lines.push(`summary only: ${report.display.summaryOnly}`);
    if (report.display.limit !== undefined) {
      lines.push(`limit: ${report.display.limit}`);
    }
    lines.push(`truncated: ${report.display.truncated}`);
  }

  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of report.warnings) {
      lines.push(`- [${warning.code}] ${(warning.catalog_id ?? '-')} ${(warning.query_id ?? '-')} ${(warning.sql_file ?? '-')}`);
      lines.push(`  ${warning.message}`);
    }
  }

  if (report.view === 'impact') {
    lines.push('', 'Affected queries:');
    appendImpactMatches(lines, report.matches as QueryUsageMatchImpact[]);
    return `${lines.join('\n')}\n`;
  }

  const primary = (report.matches as QueryUsageMatchDetail[]).filter((match) => match.source === 'ast');
  const fallback = (report.matches as QueryUsageMatchDetail[]).filter((match) => match.source === 'fallback');
  lines.push('', 'Primary matches:');
  appendDetailMatches(lines, primary);
  lines.push('', 'Fallback-derived matches:');
  appendDetailMatches(lines, fallback);
  return `${lines.join('\n')}\n`;
}

export function applyQueryOutputControls(
  report: QueryUsageReport,
  options: { limit?: number; summaryOnly?: boolean }
): QueryUsageReport {
  const summaryOnly = Boolean(options.summaryOnly);
  const limit = options.limit;
  const totalMatches = report.matches.length;
  const totalWarnings = report.warnings.length;

  let matches = summaryOnly ? [] : report.matches;
  let warnings = summaryOnly ? [] : report.warnings;

  if (!summaryOnly && limit !== undefined) {
    matches = matches.slice(0, limit);
    warnings = warnings.slice(0, limit);
  }

  return {
    ...report,
    matches,
    warnings,
    display: {
      summaryOnly,
      limit,
      totalMatches,
      returnedMatches: matches.length,
      totalWarnings,
      returnedWarnings: warnings.length,
      truncated: summaryOnly || matches.length < totalMatches || warnings.length < totalWarnings
    }
  };
}

function appendImpactMatches(lines: string[], matches: QueryUsageMatchImpact[]): void {
  if (matches.length === 0) {
    lines.push('(none)');
    return;
  }

  for (const match of matches) {
    lines.push(`- ${match.catalog_id} ${match.query_id} ${match.confidence}`);
    lines.push(`  sql_file: ${match.sql_file}`);
    lines.push(`  statement_fingerprint: ${match.statement_fingerprint}`);
    lines.push(`  source: ${match.source}`);
    lines.push(`  usageKinds: ${formatUsageKindCounts(match.usageKindCounts)}`);
    lines.push(`  notes: ${match.notes.length > 0 ? match.notes.join(', ') : '(none)'}`);
  }
}

function appendDetailMatches(lines: string[], matches: QueryUsageMatchDetail[]): void {
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

function formatUsageKindCounts(value: Record<string, number>): string {
  return Object.keys(value)
    .sort()
    .map((usageKind) => `${usageKind}=${value[usageKind]}`)
    .join(', ');
}

function formatLocation(match: QueryUsageMatchDetail): string {
  if (!match.location) {
    return '(unresolved)';
  }
  return `${match.location.startLine}:${match.location.startColumn}-${match.location.endLine}:${match.location.endColumn} @ ${match.location.fileOffsetStart}-${match.location.fileOffsetEnd}`;
}

function getLocationStart(match: QueryUsageMatch): number | undefined {
  if (match.kind === 'impact') {
    return match.representatives?.[0]?.location?.fileOffsetStart;
  }
  return match.location?.fileOffsetStart;
}

function compareUsageKey(match: QueryUsageMatch): string {
  if (match.kind === 'impact') {
    return Object.keys(match.usageKindCounts).sort().join(',');
  }
  return match.usage_kind;
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
