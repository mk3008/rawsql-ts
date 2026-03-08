import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BinarySelectQuery,
  CommonTable,
  DeleteQuery,
  FromClause,
  HavingClause,
  InsertQuery,
  JoinClause,
  JoinOnClause,
  SimpleSelectQuery,
  SqlFormatter,
  SqlParser,
  UpdateQuery,
  ValuesQuery,
  WhereClause,
  type ValueComponent
} from 'rawsql-ts';
import {
  analyzeStatement,
  assertSupportedStatement,
  collectReachableCtes,
  detectQueryType,
  type SupportedStatement
} from './analysis';

export type QueryLintFormat = 'text' | 'json';
export type QueryLintSeverity = 'error' | 'warning' | 'info';
export type QueryLintIssueType =
  | 'unused-cte'
  | 'duplicate-join-block'
  | 'duplicate-filter-predicate'
  | 'dependency-cycle'
  | 'analysis-risk'
  | 'large-cte';

export interface QueryLintIssue {
  type: QueryLintIssueType;
  severity: QueryLintSeverity;
  message: string;
  cte?: string;
  cycle?: string[];
  fragment?: string;
  occurrences?: string[];
  line_count?: number;
  risk_pattern?: string;
}

export interface QueryLintReport {
  file: string;
  query_type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  cte_count: number;
  issue_count: number;
  issues: QueryLintIssue[];
}

const LARGE_CTE_LINE_THRESHOLD = 40;
const SEVERITY_ORDER: Record<QueryLintSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2
};

const ANALYSIS_RISK_PATTERNS: Array<{ pattern: RegExp; riskPattern: string; message: string }> = [
  {
    pattern: /\$\{[^}]+\}/,
    riskPattern: 'template-interpolation',
    message: 'template interpolation detected; static analysis may not reflect the executed SQL'
  },
  {
    pattern: /\{\{[^}]+\}\}/,
    riskPattern: 'mustache-template',
    message: 'template placeholders detected; static analysis may not reflect the executed SQL'
  },
  {
    pattern: /\bexecute\b/i,
    riskPattern: 'execute-dynamic-sql',
    message: 'EXECUTE detected; dynamic SQL prevents stable structural analysis'
  },
  {
    pattern: /\bformat\s*\(/i,
    riskPattern: 'format-sql-construction',
    message: 'format(...) detected; SQL string construction may hide runtime dependencies'
  },
  {
    pattern: /'[^']*'\s*\|\||\|\|\s*'[^']*'/,
    riskPattern: 'string-concatenation',
    message: 'string concatenation detected; SQL construction may not be mechanically analyzable'
  }
];

interface PatternOccurrence {
  scope: string;
  normalized: string;
  preview: string;
}

/**
 * Build a structural maintainability lint report for one SQL file.
 */
export function buildQueryLintReport(sqlFile: string): QueryLintReport {
  const absolutePath = path.resolve(sqlFile);
  const sql = readFileSync(absolutePath, 'utf8');
  const statement = assertSupportedStatement(SqlParser.parse(sql), 'ztd query lint');
  const analysis = analyzeStatement(statement);
  const formatter = new SqlFormatter();
  const issues: QueryLintIssue[] = [];

  const usedCtes = collectReachableCtes(analysis.rootDependencies, analysis.dependencyMap);
  for (const cteName of analysis.cteNames.filter((name) => !usedCtes.has(name)).sort()) {
    issues.push({
      type: 'unused-cte',
      severity: 'warning',
      cte: cteName,
      message: `${cteName} is defined but never used`
    });
  }

  for (const cycle of detectDependencyCycles(analysis.dependencyMap)) {
    issues.push({
      type: 'dependency-cycle',
      severity: 'error',
      cycle,
      message: `cycle detected (${cycle.join(' -> ')})`
    });
  }

  for (const duplicate of findDuplicatePatterns(statement, analysis.ctes, formatter)) {
    issues.push(duplicate);
  }

  for (const cte of analysis.ctes) {
    const formattedSql = formatter.format(cte.query).formattedSql;

    // The formatter can collapse wide statements into a handful of lines,
    // so approximate line pressure from total SQL length as a fallback signal.
    const lineCount = formattedSql.split(/\r?\n/).length;
    const estimatedLineCount = Math.max(lineCount, Math.ceil(formattedSql.length / 50));
    if (estimatedLineCount > LARGE_CTE_LINE_THRESHOLD) {
      issues.push({
        type: 'large-cte',
        severity: 'info',
        cte: cte.aliasExpression.table.name,
        line_count: estimatedLineCount,
        message: `${cte.aliasExpression.table.name} contains approximately ${estimatedLineCount} lines of SQL`
      });
    }
  }

  for (const risk of detectAnalysisRiskPatterns(sql)) {
    issues.push(risk);
  }

  const sortedIssues = issues.sort((left, right) =>
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    || left.type.localeCompare(right.type)
    || left.message.localeCompare(right.message)
  );

  return {
    file: absolutePath,
    query_type: detectQueryType(statement),
    cte_count: analysis.ctes.length,
    issue_count: sortedIssues.length,
    issues: sortedIssues
  };
}

/**
 * Render the query lint report in the requested output format.
 */
export function formatQueryLintReport(report: QueryLintReport, format: QueryLintFormat): string {
  if (format === 'json') {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  if (report.issues.length === 0) {
    return 'No query lint issues detected.\n';
  }

  const lines = report.issues.map((issue) => `${formatSeverity(issue.severity)}  ${issue.type}: ${issue.message}`);
  return `${lines.join('\n')}\n`;
}

function formatSeverity(severity: QueryLintSeverity): string {
  switch (severity) {
    case 'error':
      return 'ERROR';
    case 'warning':
      return 'WARN';
    case 'info':
    default:
      return 'INFO';
  }
}

function detectDependencyCycles(dependencyMap: Map<string, string[]>): string[][] {
  const cycles = new Map<string, string[]>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function visit(name: string): void {
    if (visited.has(name)) {
      return;
    }

    visiting.add(name);
    stack.push(name);

    for (const dependency of dependencyMap.get(name) ?? []) {
      if (!visiting.has(dependency)) {
        visit(dependency);
        continue;
      }

      const startIndex = stack.indexOf(dependency);
      if (startIndex === -1) {
        continue;
      }
      const cycle = [...stack.slice(startIndex), dependency];
      const canonical = canonicalizeCycle(cycle);
      cycles.set(canonical.join(' -> '), canonical);
    }

    stack.pop();
    visiting.delete(name);
    visited.add(name);
  }

  for (const name of Array.from(dependencyMap.keys()).sort()) {
    visit(name);
  }

  return Array.from(cycles.values()).sort((left, right) => left.join(' -> ').localeCompare(right.join(' -> ')));
}

function canonicalizeCycle(cycle: string[]): string[] {
  const nodes = cycle.slice(0, -1);
  if (nodes.length === 0) {
    return cycle;
  }

  const rotations = nodes.map((_, index) => {
    const rotated = [...nodes.slice(index), ...nodes.slice(0, index)];
    return [...rotated, rotated[0]];
  });

  return rotations.sort((left, right) => left.join(' -> ').localeCompare(right.join(' -> ')))[0];
}

function findDuplicatePatterns(
  statement: SupportedStatement,
  ctes: CommonTable[],
  formatter: SqlFormatter
): QueryLintIssue[] {
  const joinOccurrences: PatternOccurrence[] = [];
  const predicateOccurrences: PatternOccurrence[] = [];

  for (const cte of ctes) {
    const supportedQuery = toSupportedStatement(cte.query);
    if (!supportedQuery) {
      continue;
    }

    collectPatternsFromStatement(
      supportedQuery,
      cte.aliasExpression.table.name,
      formatter,
      joinOccurrences,
      predicateOccurrences
    );
  }
  collectPatternsFromStatement(statement, 'FINAL_QUERY', formatter, joinOccurrences, predicateOccurrences);

  return [
    ...buildDuplicateIssues('duplicate-join-block', 'warning', 'repeated join logic detected', joinOccurrences),
    ...buildDuplicateIssues('duplicate-filter-predicate', 'warning', 'repeated filter predicate detected', predicateOccurrences)
  ];
}

function collectPatternsFromStatement(
  statement: SupportedStatement | SimpleSelectQuery | BinarySelectQuery | ValuesQuery,
  scope: string,
  formatter: SqlFormatter,
  joinOccurrences: PatternOccurrence[],
  predicateOccurrences: PatternOccurrence[]
): void {
  if (statement instanceof InsertQuery) {
    if (statement.selectQuery) {
      collectPatternsFromStatement(assertSelectStatement(statement.selectQuery), scope, formatter, joinOccurrences, predicateOccurrences);
    }
    return;
  }

  if (statement instanceof UpdateQuery) {
    collectPatternsFromFromClause(statement.fromClause, scope, formatter, joinOccurrences);
    collectPredicateOccurrence(statement.whereClause, scope, formatter, predicateOccurrences);
    return;
  }

  if (statement instanceof DeleteQuery) {
    collectPredicateOccurrence(statement.whereClause, scope, formatter, predicateOccurrences);
    return;
  }

  if (statement instanceof BinarySelectQuery) {
    collectPatternsFromStatement(assertSelectStatement(statement.left), `${scope}.left`, formatter, joinOccurrences, predicateOccurrences);
    collectPatternsFromStatement(assertSelectStatement(statement.right), `${scope}.right`, formatter, joinOccurrences, predicateOccurrences);
    return;
  }

  if (statement instanceof ValuesQuery) {
    return;
  }

  collectPatternsFromFromClause(statement.fromClause, scope, formatter, joinOccurrences);
  collectPredicateOccurrence(statement.whereClause, scope, formatter, predicateOccurrences);
  collectPredicateOccurrence(statement.havingClause, scope, formatter, predicateOccurrences);
}

function collectPatternsFromFromClause(
  fromClause: FromClause | null | undefined,
  scope: string,
  formatter: SqlFormatter,
  joinOccurrences: PatternOccurrence[]
): void {
  if (!fromClause?.joins) {
    return;
  }

  for (const join of fromClause.joins) {
    const preview = formatter.format(join).formattedSql;
    joinOccurrences.push({
      scope,
      preview,
      normalized: normalizeSqlFragment(preview)
    });
    if (join.condition instanceof JoinOnClause) {
      // Keep the join block only once; duplicate predicate detection focuses on WHERE/HAVING for now.
      continue;
    }
  }
}

function collectPredicateOccurrence(
  clause: WhereClause | HavingClause | null | undefined,
  scope: string,
  formatter: SqlFormatter,
  predicateOccurrences: PatternOccurrence[]
): void {
  if (!clause) {
    return;
  }

  const preview = formatter.format(clause.condition as ValueComponent).formattedSql;
  predicateOccurrences.push({
    scope,
    preview,
    normalized: normalizeSqlFragment(preview)
  });
}

function buildDuplicateIssues(
  type: Extract<QueryLintIssueType, 'duplicate-join-block' | 'duplicate-filter-predicate'>,
  severity: QueryLintSeverity,
  messagePrefix: string,
  occurrences: PatternOccurrence[]
): QueryLintIssue[] {
  const groups = new Map<string, PatternOccurrence[]>();
  for (const occurrence of occurrences) {
    const list = groups.get(occurrence.normalized) ?? [];
    list.push(occurrence);
    groups.set(occurrence.normalized, list);
  }

  return Array.from(groups.values())
    .filter((group) => new Set(group.map((item) => item.scope)).size > 1)
    .sort((left, right) => left[0].normalized.localeCompare(right[0].normalized))
    .map((group) => ({
      type,
      severity,
      fragment: group[0].preview,
      occurrences: Array.from(new Set(group.map((item) => item.scope))).sort(),
      message: `${messagePrefix} across ${Array.from(new Set(group.map((item) => item.scope))).sort().join(', ')}`
    }));
}

function detectAnalysisRiskPatterns(sql: string): QueryLintIssue[] {
  return ANALYSIS_RISK_PATTERNS
    .filter(({ pattern }) => pattern.test(sql))
    .map(({ riskPattern, message }) => ({
      type: 'analysis-risk' as const,
      severity: 'warning' as const,
      risk_pattern: riskPattern,
      message
    }));
}

function normalizeSqlFragment(sql: string): string {
  return sql
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function assertSelectStatement(statement: unknown): SimpleSelectQuery | BinarySelectQuery | ValuesQuery {
  if (
    statement instanceof SimpleSelectQuery ||
    statement instanceof BinarySelectQuery ||
    statement instanceof ValuesQuery
  ) {
    return statement;
  }

  throw new Error('Expected a SELECT-compatible statement while linting query patterns.');
}

function toSupportedStatement(statement: unknown): SupportedStatement | null {
  if (
    statement instanceof SimpleSelectQuery ||
    statement instanceof BinarySelectQuery ||
    statement instanceof ValuesQuery ||
    statement instanceof InsertQuery ||
    statement instanceof UpdateQuery ||
    statement instanceof DeleteQuery
  ) {
    return statement;
  }

  return null;
}



