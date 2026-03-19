import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BinarySelectQuery,
  CommonTable,
  CTETableReferenceCollector,
  DeleteQuery,
  BinaryExpression,
  ColumnReference,
  CreateTableQuery,
  FromClause,
  HavingClause,
  IdentifierString,
  InsertQuery,
  JoinClause,
  JoinOnClause,
  JoinUsingClause,
  FunctionCall,
  ParenExpression,
  SimpleSelectQuery,
  SourceExpression,
  TableSource,
  SqlFormatter,
  SqlParser,
  MultiQuerySplitter,
  UpdateQuery,
  ValuesQuery,
  WhereClause,
  ValueList,
  normalizeTableName,
  type RelationGraph,
  type ValueComponent
} from 'rawsql-ts';
import {
  analyzeStatement,
  assertSupportedStatement,
  collectReachableCtes,
  detectQueryType,
  type SupportedStatement
} from './analysis';
import { loadZtdProjectConfig } from '../utils/ztdProjectConfig';
import { collectSqlFiles } from '../utils/collectSqlFiles';
import { buildRelationGraphFromCreateTableQueries, getOutgoingRelations } from 'rawsql-ts';

export type QueryLintFormat = 'text' | 'json';
export type QueryLintSeverity = 'error' | 'warning' | 'info';
export type QueryLintRule = 'join-direction';
export type QueryLintIssueType =
  | 'unused-cte'
  | 'duplicate-join-block'
  | 'duplicate-filter-predicate'
  | 'dependency-cycle'
  | 'analysis-risk'
  | 'large-cte'
  | 'join-direction';

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
  join_type?: string;
  subject_table?: string;
  joined_table?: string;
  child_table?: string;
  parent_table?: string;
  child_columns?: string[];
  parent_columns?: string[];
}

export interface QueryLintReport {
  file: string;
  query_type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  cte_count: number;
  issue_count: number;
  issues: QueryLintIssue[];
}

export interface QueryLintBuildOptions {
  projectRoot?: string;
  rules?: QueryLintRule[];
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
export function buildQueryLintReport(sqlFile: string, options: QueryLintBuildOptions = {}): QueryLintReport {
  const absolutePath = path.resolve(sqlFile);
  const sql = readFileSync(absolutePath, 'utf8');
  const statement = assertSupportedStatement(SqlParser.parse(sql), 'ztd query lint');
  const analysis = analyzeStatement(statement);
  const formatter = new SqlFormatter();
  const issues: QueryLintIssue[] = [];
  const enabledRules = new Set(options.rules ?? []);

  const usedCtes = collectReachableCtes(analysis.rootDependencies, analysis.dependencyMap);
  for (const cteName of analysis.cteNames.filter((name) => !usedCtes.has(name)).sort()) {
    issues.push({
      type: 'unused-cte',
      severity: 'warning',
      cte: cteName,
      message: `${cteName} is defined but never used`
    });
  }

  const allowedRecursiveSelfReferences = collectAllowedRecursiveSelfReferences(statement, analysis.ctes);
  for (const cycle of detectDependencyCycles(analysis.dependencyMap, allowedRecursiveSelfReferences)) {
    issues.push({
      type: 'dependency-cycle',
      severity: 'error',
      cycle,
      message: `invalid dependency cycle detected (${cycle.join(' -> ')})`
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

  if (enabledRules.has('join-direction')) {
    const relationGraph = loadJoinDirectionRelationGraph(options.projectRoot);
    if (relationGraph) {
      issues.push(...buildJoinDirectionIssues(statement, analysis.ctes, relationGraph, sql));
    }
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

function detectDependencyCycles(
  dependencyMap: Map<string, string[]>,
  allowedRecursiveSelfReferences: Set<string>
): string[][] {
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
      if (isAllowedRecursiveCycle(canonical, allowedRecursiveSelfReferences)) {
        continue;
      }
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

function collectAllowedRecursiveSelfReferences(
  statement: SupportedStatement,
  ctes: CommonTable[]
): Set<string> {
  const withClause = getStatementWithClause(statement);
  if (!withClause?.recursive) {
    return new Set<string>();
  }

  const collector = new CTETableReferenceCollector();
  return new Set(
    ctes
      .filter((cte) => collector.collect(cte.query).some((source) => source.table.name === cte.aliasExpression.table.name))
      .map((cte) => cte.aliasExpression.table.name)
  );
}

function isAllowedRecursiveCycle(cycle: string[], allowedRecursiveSelfReferences: Set<string>): boolean {
  const nodes = cycle.slice(0, -1);
  return nodes.length === 1
    && cycle[0] === cycle[cycle.length - 1]
    && allowedRecursiveSelfReferences.has(nodes[0]);
}

function getStatementWithClause(statement: SupportedStatement): { recursive: boolean } | null {
  if (statement instanceof InsertQuery) {
    return statement.selectQuery ? getSelectStatementWithClause(assertSelectStatement(statement.selectQuery)) : null;
  }

  if (statement instanceof BinarySelectQuery) {
    return null;
  }

  return getQueryWithClause(statement);
}

function getSelectStatementWithClause(statement: SimpleSelectQuery | BinarySelectQuery | ValuesQuery): { recursive: boolean } | null {
  if (statement instanceof BinarySelectQuery) {
    return null;
  }

  return getQueryWithClause(statement);
}

function getQueryWithClause(statement: SimpleSelectQuery | ValuesQuery | UpdateQuery | DeleteQuery): { recursive: boolean } | null {
  const candidate = statement as { withClause?: { recursive: boolean } | null };
  return candidate.withClause ?? null;
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

function loadJoinDirectionRelationGraph(projectRoot?: string): RelationGraph | null {
  const resolvedRoot = path.resolve(projectRoot ?? process.env.ZTD_PROJECT_ROOT ?? process.cwd());
  let config;
  try {
    config = loadZtdProjectConfig(resolvedRoot);
  } catch {
    return null;
  }

  const ddlRoot = path.resolve(resolvedRoot, config.ddlDir);
  let ddlSources;
  try {
    ddlSources = collectSqlFiles([ddlRoot], ['.sql']);
  } catch {
    return null;
  }

  const createTableQueries: CreateTableQuery[] = [];
  for (const source of ddlSources) {
    let split;
    try {
      split = MultiQuerySplitter.split(source.sql);
    } catch {
      continue;
    }

    for (const chunk of split.queries) {
      if (chunk.isEmpty) {
        continue;
      }

      try {
        const parsed = SqlParser.parse(chunk.sql);
        if (parsed instanceof CreateTableQuery) {
          createTableQueries.push(parsed);
        }
      } catch {
        continue;
      }
    }
  }

  if (createTableQueries.length === 0) {
    return null;
  }

  return buildRelationGraphFromCreateTableQueries(createTableQueries);
}

function buildJoinDirectionIssues(
  statement: SupportedStatement,
  ctes: CommonTable[],
  relationGraph: RelationGraph,
  sql: string
): QueryLintIssue[] {
  if (hasJoinDirectionSuppression(sql)) {
    return [];
  }

  const issues: QueryLintIssue[] = [];
  for (const target of collectJoinDirectionTargets(statement, ctes)) {
    issues.push(...inspectJoinDirectionQuery(target.query, target.scope, relationGraph));
  }
  return issues;
}

function collectJoinDirectionTargets(
  statement: SupportedStatement,
  ctes: CommonTable[]
): Array<{ query: SimpleSelectQuery; scope: string }> {
  const targets: Array<{ query: SimpleSelectQuery; scope: string }> = [];

  for (const cte of ctes) {
    if (cte.query instanceof SimpleSelectQuery) {
      targets.push({ query: cte.query, scope: cte.aliasExpression.table.name });
    }
  }

  if (statement instanceof SimpleSelectQuery) {
    targets.push({ query: statement, scope: 'FINAL_QUERY' });
  } else if (statement instanceof InsertQuery && statement.selectQuery instanceof SimpleSelectQuery) {
    targets.push({ query: statement.selectQuery, scope: 'FINAL_QUERY' });
  }

  return targets;
}

function inspectJoinDirectionQuery(
  query: SimpleSelectQuery,
  scope: string,
  relationGraph: RelationGraph
): QueryLintIssue[] {
  if (shouldSkipJoinDirectionQuery(query)) {
    return [];
  }

  const fromClause = query.fromClause;
  if (!fromClause?.joins || fromClause.joins.length === 0) {
    return [];
  }

  const rootSource = resolveSourceTable(fromClause.source);
  if (!rootSource) {
    return [];
  }

  const issues: QueryLintIssue[] = [];
  let currentSource = rootSource;

  for (const join of fromClause.joins) {
    const joinSource = resolveSourceTable(join.source);
    if (!joinSource || join.lateral || !isInspectableInnerJoin(join.joinType.value)) {
      break;
    }

    const comparison = extractJoinComparison(join.condition, currentSource, joinSource);
    if (!comparison) {
      break;
    }

    const forwardMatch = findMatchingRelation(
      getOutgoingRelations(relationGraph, currentSource.tableName),
      joinSource.tableName,
      comparison
    );
    if (forwardMatch) {
      currentSource = joinSource;
      continue;
    }

    const reverseMatch = findMatchingRelation(
      getOutgoingRelations(relationGraph, joinSource.tableName),
      currentSource.tableName,
      comparison
    );
    if (reverseMatch) {
      issues.push(
        buildJoinDirectionIssue(scope, join.joinType.value, currentSource.tableName, joinSource.tableName, reverseMatch)
      );
      currentSource = joinSource;
      continue;
    }

    if (
      hasAmbiguousRelation(relationGraph, currentSource.tableName, joinSource.tableName) ||
      hasAmbiguousRelation(relationGraph, joinSource.tableName, currentSource.tableName)
    ) {
      break;
    }
    break;
  }

  return issues;
}

function shouldSkipJoinDirectionQuery(query: SimpleSelectQuery): boolean {
  if (query.groupByClause || query.havingClause) {
    return true;
  }

  if (query.selectClause.items.some((item) => containsAggregateFunction(item.value))) {
    return true;
  }

  return containsNamedFunction(query.whereClause?.condition, new Set(['exists']));
}

function containsAggregateFunction(value: ValueComponent | null | undefined): boolean {
  return containsNamedFunction(
    value,
    new Set(['count', 'sum', 'avg', 'min', 'max', 'string_agg', 'array_agg', 'json_agg', 'jsonb_agg', 'bool_and', 'bool_or'])
  );
}

function containsNamedFunction(value: ValueComponent | null | undefined, names: ReadonlySet<string>): boolean {
  if (!value) {
    return false;
  }

  if (value instanceof FunctionCall) {
    const functionName = value.name instanceof IdentifierString ? value.name.name : value.name.value;
    if (names.has(functionName.toLowerCase())) {
      return true;
    }
    return containsNamedFunction(value.argument, names) ||
      containsNamedFunction(value.filterCondition, names);
  }

  if (value instanceof BinaryExpression) {
    return containsNamedFunction(value.left, names) || containsNamedFunction(value.right, names);
  }

  if (value instanceof ParenExpression) {
    return containsNamedFunction(value.expression, names);
  }

  if (value instanceof ValueList) {
    return value.values.some((entry) => containsNamedFunction(entry, names));
  }

  return false;
}

function resolveSourceTable(source: SourceExpression): ResolvedSourceTable | null {
  if (!(source.datasource instanceof TableSource)) {
    return null;
  }

  const tableName = normalizeTableName(source.datasource.getSourceName());
  const alias = normalizeTableName(source.getAliasName() ?? source.datasource.getSourceName());
  const ownerNames = new Set<string>([tableName, alias]);
  return { tableName, alias, ownerNames };
}

interface JoinComparison {
  currentColumns: string[];
  joinedColumns: string[];
}

function extractJoinComparison(
  condition: JoinClause['condition'],
  currentSource: ResolvedSourceTable,
  joinedSource: ResolvedSourceTable
): JoinComparison | null {
  if (condition instanceof JoinUsingClause) {
    return extractUsingComparison(condition.condition);
  }

  if (condition instanceof JoinOnClause) {
    return extractOnComparison(condition.condition, currentSource, joinedSource);
  }

  return null;
}

function extractUsingComparison(
  value: ValueComponent
): JoinComparison | null {
  if (!(value instanceof ValueList)) {
    return null;
  }

  const columns: string[] = [];
  for (const entry of value.values) {
    if (!(entry instanceof ColumnReference) && !(entry instanceof IdentifierString)) {
      return null;
    }
    const name = entry instanceof ColumnReference ? entry.column.name : entry.name;
    if (!name) {
      return null;
    }
    columns.push(name);
  }

  return {
    currentColumns: columns,
    joinedColumns: columns
  };
}

function extractOnComparison(
  value: ValueComponent,
  currentSource: ResolvedSourceTable,
  joinedSource: ResolvedSourceTable
): JoinComparison | null {
  const pairs = collectOnComparisonPairs(value, currentSource, joinedSource);
  if (!pairs || pairs.length === 0) {
    return null;
  }

  return {
    currentColumns: pairs.map((pair) => pair.currentColumn),
    joinedColumns: pairs.map((pair) => pair.joinedColumn)
  };
}

function collectOnComparisonPairs(
  value: ValueComponent,
  currentSource: ResolvedSourceTable,
  joinedSource: ResolvedSourceTable
): Array<{ currentColumn: string; joinedColumn: string }> | null {
  if (value instanceof ParenExpression) {
    return collectOnComparisonPairs(value.expression, currentSource, joinedSource);
  }

  if (value instanceof BinaryExpression) {
    const operator = value.operator.value.toLowerCase();
    if (operator === 'and') {
      const left = collectOnComparisonPairs(value.left, currentSource, joinedSource);
      const right = collectOnComparisonPairs(value.right, currentSource, joinedSource);
      if (!left || !right) {
        return null;
      }
      return [...left, ...right];
    }

    if (operator !== '=') {
      return null;
    }

    const pair = resolveEqualityPair(value.left, value.right, currentSource, joinedSource);
    if (pair) {
      return [pair];
    }

    const reversed = resolveEqualityPair(value.right, value.left, currentSource, joinedSource);
    if (reversed) {
      return [{ currentColumn: reversed.joinedColumn, joinedColumn: reversed.currentColumn }];
    }
  }

  return null;
}

function resolveEqualityPair(
  left: ValueComponent,
  right: ValueComponent,
  currentSource: ResolvedSourceTable,
  joinedSource: ResolvedSourceTable
): { currentColumn: string; joinedColumn: string } | null {
  const leftRef = extractColumnReference(left);
  const rightRef = extractColumnReference(right);
  if (!leftRef || !rightRef) {
    return null;
  }

  const leftOwner = normalizeTableName(leftRef.owner);
  const rightOwner = normalizeTableName(rightRef.owner);
  if (!isOwnerMatch(leftOwner, currentSource) || !isOwnerMatch(rightOwner, joinedSource)) {
    return null;
  }

  return {
    currentColumn: leftRef.column,
    joinedColumn: rightRef.column
  };
}

function extractColumnReference(value: ValueComponent): { owner: string; column: string } | null {
  if (!(value instanceof ColumnReference)) {
    return null;
  }

  const owner = value.namespaces?.map((namespace) => namespace.name).join('.');
  if (!owner) {
    return null;
  }

  const column = value.column.name;
  if (!column) {
    return null;
  }

  return {
    owner,
    column
  };
}

interface ResolvedSourceTable {
  tableName: string;
  alias: string;
  ownerNames: Set<string>;
}

function isOwnerMatch(owner: string, source: ResolvedSourceTable): boolean {
  return source.ownerNames.has(normalizeTableName(owner));
}

function findMatchingRelation(
  candidates: ReturnType<typeof getOutgoingRelations>,
  expectedParentTable: string,
  comparison: JoinComparison
): ReturnType<typeof getOutgoingRelations>[number] | null {
  const matches = candidates.filter((candidate) => candidate.parentTable === expectedParentTable);
  if (matches.length === 0) {
    return null;
  }

  const matched = matches.find((candidate) => relationMatchesComparison(candidate, comparison));
  if (!matched) {
    return null;
  }

  return matched;
}

function relationMatchesComparison(candidate: ReturnType<typeof getOutgoingRelations>[number], comparison: JoinComparison): boolean {
  if (candidate.childColumns.length === 0 || candidate.parentColumns.length === 0) {
    return true;
  }

  return sameNormalizedColumns(candidate.childColumns, comparison.currentColumns) &&
    sameNormalizedColumns(candidate.parentColumns, comparison.joinedColumns);
}

function sameNormalizedColumns(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const normalize = (values: string[]) => [...values].map((value) => value.toLowerCase()).sort();
  const leftNormalized = normalize(left);
  const rightNormalized = normalize(right);
  return leftNormalized.every((value, index) => value === rightNormalized[index]);
}

function hasAmbiguousRelation(
  relationGraph: RelationGraph,
  leftTable: string,
  rightTable: string
): boolean {
  const forward = getOutgoingRelations(relationGraph, leftTable).filter((edge) => edge.parentTable === rightTable);
  const reverse = getOutgoingRelations(relationGraph, rightTable).filter((edge) => edge.parentTable === leftTable);
  return forward.length > 1 || reverse.length > 1;
}

function buildJoinDirectionIssue(
  scope: string,
  joinType: string,
  subjectTable: string,
  joinedTable: string,
  relation: ReturnType<typeof getOutgoingRelations>[number]
): QueryLintIssue {
  return {
    type: 'join-direction',
    severity: 'warning',
    cte: scope === 'FINAL_QUERY' ? undefined : scope,
    join_type: joinType,
    subject_table: subjectTable,
    joined_table: joinedTable,
    child_table: relation.childTable,
    parent_table: relation.parentTable,
    child_columns: relation.childColumns,
    parent_columns: relation.parentColumns,
    message: `JOIN direction is reversed for ${relation.childTable} -> ${relation.parentTable}; prefer starting from the child table and joining upward`
  };
}

function isInspectableInnerJoin(joinType: string): boolean {
  const normalized = joinType.trim().toLowerCase();
  return normalized === 'join' || normalized === 'inner join';
}

function hasJoinDirectionSuppression(sql: string): boolean {
  return /ztd-lint-disable\s+join-direction/i.test(sql);
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

