import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BinaryExpression,
  BinarySelectQuery,
  BetweenExpression,
  ColumnReference,
  FunctionCall,
  LiteralValue,
  OrderByClause,
  OrderByItem,
  ParenExpression,
  ParameterExpression,
  RawString,
  SelectQuery,
  SelectQueryParser,
  SimpleSelectQuery,
  SourceExpression,
  SubQuerySource,
  TableSource,
  TupleExpression,
  UnaryExpression,
  ValueComponent,
  splitQueries
} from 'rawsql-ts';

import { createQueryFingerprint } from '../utils/queryFingerprint';
import type {
  ObservedSqlMatchCandidate,
  ObservedSqlMatchReport,
  ObservedSqlMatchReportParams,
  ObservedSqlMatchSectionScores,
  ObservedSqlMatchWarning,
  ObservedSqlOutputFormat,
  ObservedSqlQuerySummary
} from './types';

const DEFAULT_TOP_RESULTS = 10;
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'tmp',
  'generated',
  '.turbo',
  '.next',
  '.nuxt',
  'out'
]);

interface SummaryCollector {
  projectionTokens: Set<string>;
  sourceTokens: Set<string>;
  whereTokens: Set<string>;
  whereFamilies: Set<string>;
  orderTokens: Set<string>;
  pagingTokens: Set<string>;
  setOperationTokens: Set<string>;
}

interface CandidateSummary {
  sql_file: string;
  query_index: number;
  summary: ObservedSqlQuerySummary;
}

interface ScoredPair {
  score: number;
  section_scores: ObservedSqlMatchSectionScores;
  reasons: string[];
  differences: string[];
}

/**
 * Discover `.sql` assets beneath a project root.
 */
export function discoverObservedSqlAssetFiles(rootDir: string): string[] {
  const absoluteRoot = path.resolve(rootDir);
  const files: string[] = [];
  const stack = [absoluteRoot];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = readdirSync(current, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name)
    );

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) {
          continue;
        }
        stack.push(absolute);
        continue;
      }

      if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.sql') {
        files.push(absolute);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

/**
 * Build a ranking report for observed SQL against project SQL assets.
 */
export function buildObservedSqlMatchReport(params: ObservedSqlMatchReportParams): ObservedSqlMatchReport {
  const rootDir = path.resolve(params.rootDir ?? process.cwd());
  const topResults = params.topResults ?? DEFAULT_TOP_RESULTS;
  const readFile = params.readFileSync ?? readFileSync;
  const warnings: ObservedSqlMatchWarning[] = [];

  const observedSummaries = collectQuerySummaries(params.observedSql, 'observed SQL', warnings);
  if (observedSummaries.length === 0) {
    throw new Error('Observed SQL did not contain a parsable SELECT statement.');
  }

  if (observedSummaries.length > 1) {
    warnings.push({
      code: 'multiple-observed-queries',
      message: 'Multiple observed statements were supplied; each candidate is ranked against the best observed match.'
    });
  }

  const candidateFiles = discoverObservedSqlAssetFiles(rootDir);
  const candidates: CandidateSummary[] = [];
  let filesRead = 0;
  let filesSkipped = 0;
  let queriesSkipped = 0;

  for (const sqlFile of candidateFiles) {
    let sqlText: string;
    try {
      sqlText = readFile(sqlFile, 'utf8');
      filesRead += 1;
    } catch (error) {
      filesSkipped += 1;
      warnings.push({
        code: 'file-read-failed',
        sql_file: normalizePath(path.relative(rootDir, sqlFile)),
        message: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    let queries: Array<{ sql: string }>;
    try {
      queries = splitQueries(sqlText).getNonEmpty();
    } catch (error) {
      filesSkipped += 1;
      warnings.push({
        code: 'file-scan-failed',
        sql_file: normalizePath(path.relative(rootDir, sqlFile)),
        message: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    for (const [queryIndex, query] of queries.entries()) {
      const summaries = collectQuerySummaries(query.sql, normalizePath(path.relative(rootDir, sqlFile)), warnings);
      if (summaries.length === 0) {
        queriesSkipped += 1;
        continue;
      }

      for (const summary of summaries) {
        candidates.push({
          sql_file: normalizePath(path.relative(rootDir, sqlFile)),
          query_index: queryIndex,
          summary: summary.summary
        });
      }
    }
  }

  const matches: ObservedSqlMatchCandidate[] = candidates
    .map((candidate) => {
      let best: ScoredPair | null = null;
      for (const observed of observedSummaries) {
        const pair = scoreSummaries(observed.summary, candidate.summary);
        if (!best || pair.score > best.score) {
          best = pair;
        }
      }

      const pair = best ?? {
        score: 0,
        section_scores: { projection: 0, source: 0, where: 0, order: 0, paging: 0 },
        reasons: ['No comparable SELECT shape was found.'],
        differences: ['The candidate could not be compared structurally.']
      };

      return {
        sql_file: candidate.sql_file,
        query_index: candidate.query_index,
        query_fingerprint: candidate.summary.queryFingerprint,
        score: pair.score,
        section_scores: pair.section_scores,
        reasons: pair.reasons,
        differences: pair.differences,
        summary: candidate.summary
      };
    })
    .sort((left, right) => right.score - left.score || left.sql_file.localeCompare(right.sql_file) || left.query_index - right.query_index)
    .slice(0, topResults);

  return {
    schemaVersion: 1,
    rootDir,
    observedSql: params.observedSql,
    observedQueries: observedSummaries.length,
    summary: {
      filesScanned: candidateFiles.length,
      filesRead,
      filesSkipped,
      sqlFilesScanned: candidateFiles.length,
      queriesScored: candidates.length,
      queriesSkipped,
      candidates: matches.length
    },
    matches,
    warnings
  };
}

/**
 * Format a match report for text or JSON output.
 */
export function formatObservedSqlMatchReport(report: ObservedSqlMatchReport, format: ObservedSqlOutputFormat): string {
  if (format === 'json') {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  const lines: string[] = [
    'Observed SQL match report',
    `root: ${report.rootDir}`,
    `observed statements: ${report.observedQueries}`,
    `files scanned: ${report.summary.filesScanned}`,
    `files read: ${report.summary.filesRead}`,
    `files skipped: ${report.summary.filesSkipped}`,
    `queries scored: ${report.summary.queriesScored}`,
    `queries skipped: ${report.summary.queriesSkipped}`,
    `candidates returned: ${report.summary.candidates}`
  ];

  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of report.warnings) {
      lines.push(`- [${warning.code}] ${warning.sql_file ?? '-'} ${warning.query_index ?? '-'}`);
      lines.push(`  ${warning.message}`);
    }
  }

  lines.push('', 'Top matches:');
  if (report.matches.length === 0) {
    lines.push('(none)');
    return `${lines.join('\n')}\n`;
  }

  for (const match of report.matches) {
    lines.push(`- score ${match.score.toFixed(1)} ${match.sql_file}#${match.query_index}`);
    lines.push(`  fingerprint: ${match.query_fingerprint}`);
    lines.push(`  projection: ${formatSectionScore(match.section_scores.projection)}`);
    lines.push(`  source: ${formatSectionScore(match.section_scores.source)}`);
    lines.push(`  where: ${formatSectionScore(match.section_scores.where)}`);
    lines.push(`  order: ${formatSectionScore(match.section_scores.order)}`);
    lines.push(`  paging: ${formatSectionScore(match.section_scores.paging)}`);
    lines.push(`  reasons: ${match.reasons.length > 0 ? match.reasons.join(' | ') : '(none)'}`);
    lines.push(`  differences: ${match.differences.length > 0 ? match.differences.join(' | ') : '(none)'}`);
  }

  return `${lines.join('\n')}\n`;
}

function formatSectionScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

function collectQuerySummaries(
  sqlText: string,
  sqlFileLabel: string,
  warnings: ObservedSqlMatchWarning[]
): Array<{ summary: ObservedSqlQuerySummary; queryText: string }> {
  const queries = splitQueries(sqlText).getNonEmpty();
  const summaries: Array<{ summary: ObservedSqlQuerySummary; queryText: string }> = [];

  for (const [queryIndex, query] of queries.entries()) {
    if (!query.sql.trim()) {
      continue;
    }

    try {
      const parsed = SelectQueryParser.parse(query.sql);
      summaries.push({
        summary: summarizeSelectQuery(parsed, query.sql),
        queryText: query.sql
      });
    } catch (error) {
      warnings.push({
        code: 'query-parse-failed',
        sql_file: sqlFileLabel,
        query_index: queryIndex,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return summaries;
}

function summarizeSelectQuery(query: SelectQuery, sqlText: string): ObservedSqlQuerySummary {
  const collector: SummaryCollector = {
    projectionTokens: new Set<string>(),
    sourceTokens: new Set<string>(),
    whereTokens: new Set<string>(),
    whereFamilies: new Set<string>(),
    orderTokens: new Set<string>(),
    pagingTokens: new Set<string>(),
    setOperationTokens: new Set<string>()
  };
  const visited = new WeakSet<object>();

  const walk = (value: unknown): void => {
    if (!isObject(value) || visited.has(value as object)) {
      return;
    }
    visited.add(value as object);

    if (value instanceof SimpleSelectQuery) {
      collectSimpleSelectQueryTokens(value, collector);
    } else if (value instanceof BinarySelectQuery) {
      collector.setOperationTokens.add(`set-operation:${normalizeIdentifier(value.operator.value)}`);
    }

    for (const child of Object.values(value)) {
      walk(child);
    }
  };

  walk(query);

  return {
    queryFingerprint: createQueryFingerprint(sqlText),
    projectionTokens: sortedValues(collector.projectionTokens),
    sourceTokens: sortedValues(collector.sourceTokens),
    whereTokens: sortedValues(collector.whereTokens),
    whereFamilies: sortedValues(collector.whereFamilies),
    orderTokens: sortedValues(collector.orderTokens),
    pagingTokens: sortedValues(collector.pagingTokens),
    setOperationTokens: sortedValues(collector.setOperationTokens)
  };
}

function collectSimpleSelectQueryTokens(query: SimpleSelectQuery, collector: SummaryCollector): void {
  const aliasMap = buildAliasMap(query);

  if (query.withClause) {
    collector.sourceTokens.add(`with:${query.withClause.tables.length}`);
    for (const commonTable of query.withClause.tables) {
      collector.sourceTokens.add(`cte:${normalizeIdentifier(commonTable.getSourceAliasName())}`);
    }
  }

  for (const item of query.selectClause.items) {
    collector.projectionTokens.add(`select:${normalizeValueSignature(item.value, aliasMap)}`);
  }

  if (query.fromClause) {
    collector.sourceTokens.add(`from:${sourceSignature(query.fromClause.source, aliasMap)}`);
    if (query.fromClause.joins) {
      for (const join of query.fromClause.joins) {
        collector.sourceTokens.add(`join:${normalizeIdentifier(join.joinType.value)}:${sourceSignature(join.source, aliasMap)}`);
        if (join.condition) {
          for (const token of extractPredicateCoreTokens(join.condition.condition, aliasMap)) {
            collector.sourceTokens.add(`join-condition:${token}`);
          }
        }
      }
    }
  }

  if (query.whereClause) {
    for (const token of extractPredicateCoreTokens(query.whereClause.condition, aliasMap)) {
      collector.whereTokens.add(token);
    }
    if (containsOptionalPredicate(query.whereClause.condition)) {
      collector.whereFamilies.add('optional-predicate');
    }
  }

  if (query.orderByClause) {
    for (const token of extractOrderTokens(query.orderByClause, aliasMap)) {
      collector.orderTokens.add(token);
    }
  }

  if (query.limitClause) {
    collector.pagingTokens.add('limit');
  }
  if (query.offsetClause) {
    collector.pagingTokens.add('offset');
  }
  if (query.fetchClause) {
    collector.pagingTokens.add('fetch');
  }
}

function buildAliasMap(query: SimpleSelectQuery): Map<string, string> {
  const map = new Map<string, string>();

  if (query.withClause) {
    for (const commonTable of query.withClause.tables) {
      const alias = normalizeIdentifier(commonTable.getSourceAliasName());
      map.set(alias, `cte:${alias}`);
    }
  }

  if (query.fromClause) {
    registerSourceAlias(query.fromClause.source, map);
    if (query.fromClause.joins) {
      for (const join of query.fromClause.joins) {
        registerSourceAlias(join.source, map);
      }
    }
  }

  return map;
}

function registerSourceAlias(source: SourceExpression, map: Map<string, string>): void {
  const alias = source.getAliasName();
  if (!alias) {
    return;
  }
  map.set(normalizeIdentifier(alias), sourceSignature(source, map));
}

function sourceSignature(source: SourceExpression, aliasMap: Map<string, string>): string {
  if (source.datasource instanceof TableSource) {
    return `table:${normalizePath(source.datasource.getSourceName().toLowerCase())}`;
  }

  if (source.datasource instanceof SubQuerySource) {
    return 'subquery';
  }

  return `source:${normalizeIdentifier(source.getAliasName() ?? source.datasource.constructor.name)}`;
}

function extractPredicateCoreTokens(expression: ValueComponent, aliasMap: Map<string, string>): string[] {
  const tokens = new Set<string>();
  const branches = splitTopLevelAndTerms(expression);

  for (const branch of branches) {
    const optionalMeaningfulBranches = extractOptionalBranches(branch);
    if (optionalMeaningfulBranches.length > 0) {
      for (const meaningful of optionalMeaningfulBranches) {
        tokens.add(`predicate:${normalizePredicateSignature(meaningful, aliasMap)}`);
      }
      continue;
    }

    tokens.add(`predicate:${normalizePredicateSignature(branch, aliasMap)}`);
  }

  return sortedValues(tokens);
}

function containsOptionalPredicate(expression: ValueComponent): boolean {
  return extractOptionalBranches(expression).length > 0;
}

function extractOptionalBranches(expression: ValueComponent): ValueComponent[] {
  const branches = splitTopLevelOrTerms(expression);
  if (branches.length < 2) {
    return [];
  }

  const guardBranches = branches.filter(isAbsentGuardBranch);
  if (guardBranches.length !== 1) {
    return [];
  }

  return branches.filter((branch) => !isAbsentGuardBranch(branch));
}

function isAbsentGuardBranch(expression: ValueComponent): boolean {
  const candidate = unwrap(expression);
  if (!(candidate instanceof BinaryExpression)) {
    return false;
  }

  if (normalizeIdentifier(candidate.operator.value) !== 'is') {
    return false;
  }

  return candidate.left instanceof ParameterExpression && isNullLiteral(candidate.right);
}

function splitTopLevelAndTerms(expression: ValueComponent): ValueComponent[] {
  const candidate = unwrap(expression);
  if (candidate instanceof BinaryExpression && normalizeIdentifier(candidate.operator.value) === 'and') {
    return [...splitTopLevelAndTerms(candidate.left), ...splitTopLevelAndTerms(candidate.right)];
  }
  return [candidate];
}

function splitTopLevelOrTerms(expression: ValueComponent): ValueComponent[] {
  const candidate = unwrap(expression);
  if (candidate instanceof BinaryExpression && normalizeIdentifier(candidate.operator.value) === 'or') {
    return [...splitTopLevelOrTerms(candidate.left), ...splitTopLevelOrTerms(candidate.right)];
  }
  return [candidate];
}

function extractOrderTokens(orderByClause: OrderByClause, aliasMap: Map<string, string>): string[] {
  const tokens = new Set<string>();

  for (const item of orderByClause.order) {
    if (item instanceof OrderByItem) {
      const direction = normalizeIdentifier(item.sortDirection);
      const nulls = item.nullsPosition ? `:${normalizeIdentifier(item.nullsPosition)}` : '';
      tokens.add(`order:${normalizeValueSignature(item.value, aliasMap)}:${direction}${nulls}`);
    } else {
      tokens.add(`order:${normalizeValueSignature(item, aliasMap)}`);
    }
  }

  return sortedValues(tokens);
}

function normalizeValueSignature(value: ValueComponent, aliasMap: Map<string, string>): string {
  const candidate = unwrap(value);

  if (candidate instanceof ColumnReference) {
    return `column:${normalizeColumnReference(candidate, aliasMap)}`;
  }
  if (candidate instanceof LiteralValue) {
    return `literal:${literalKind(candidate.value)}`;
  }
  if (candidate instanceof ParameterExpression) {
    return `param:${normalizeIdentifier(candidate.name.value)}`;
  }
  if (candidate instanceof RawString) {
    return `raw:${normalizeIdentifier(candidate.value)}`;
  }
  if (candidate instanceof FunctionCall) {
    return normalizeFunctionSignature(candidate, aliasMap);
  }
  if (candidate instanceof BinaryExpression) {
    const operator = normalizeIdentifier(candidate.operator.value);

    if (operator === 'and' || operator === 'or') {
      return normalizeBooleanSignature(candidate, aliasMap, operator);
    }

    const left = normalizeValueSignature(candidate.left, aliasMap);
    const right = normalizeValueSignature(candidate.right, aliasMap);

    if (operator === '=' || operator === 'is') {
      const ordered = [left, right].sort();
      return `${operator}(${ordered.join('|')})`;
    }

    return `${operator}(${left}|${right})`;
  }
  if (candidate instanceof UnaryExpression) {
    return `${normalizeIdentifier(candidate.operator.value)}(${normalizeValueSignature(candidate.expression, aliasMap)})`;
  }
  if (candidate instanceof ParenExpression) {
    return `paren(${normalizeValueSignature(candidate.expression, aliasMap)})`;
  }
  if (candidate instanceof BetweenExpression) {
    return `between(${normalizeValueSignature(candidate.expression, aliasMap)}|${normalizeValueSignature(candidate.lower, aliasMap)}|${normalizeValueSignature(candidate.upper, aliasMap)}|${candidate.negated ? 'negated' : 'affirmed'})`;
  }
  if (candidate instanceof TupleExpression) {
    return `tuple(${candidate.values.map((entry) => normalizeValueSignature(entry, aliasMap)).join('|')})`;
  }

  return `${candidate.constructor?.name ?? 'Unknown'}`;
}

function normalizePredicateSignature(value: ValueComponent, aliasMap: Map<string, string>): string {
  const candidate = unwrap(value);

  if (candidate instanceof BinaryExpression) {
    const operator = normalizeIdentifier(candidate.operator.value);
    if (isComparisonOperator(operator)) {
      return `${operator}(${normalizePredicateOperand(candidate.left, aliasMap)}|${normalizePredicateOperand(candidate.right, aliasMap)})`;
    }
    if (operator === 'and' || operator === 'or') {
      return normalizeBooleanSignature(candidate, aliasMap, operator);
    }
  }

  if (candidate instanceof BetweenExpression) {
    return `between(${normalizePredicateOperand(candidate.expression, aliasMap)}|range)`;
  }

  if (candidate instanceof UnaryExpression) {
    return `${normalizeIdentifier(candidate.operator.value)}(${normalizePredicateSignature(candidate.expression, aliasMap)})`;
  }

  return normalizeValueSignature(candidate, aliasMap);
}

function normalizePredicateOperand(value: ValueComponent, aliasMap: Map<string, string>): string {
  const candidate = unwrap(value);

  if (candidate instanceof ColumnReference) {
    return `column:${normalizeColumnReference(candidate, aliasMap)}`;
  }

  if (candidate instanceof ParameterExpression) {
    return 'value:bound';
  }

  if (candidate instanceof LiteralValue) {
    return candidate.value === null ? 'value:null' : 'value:bound';
  }

  if (candidate instanceof FunctionCall) {
    return normalizeFunctionSignature(candidate, aliasMap);
  }

  if (candidate instanceof TupleExpression) {
    return `tuple:${candidate.values.length}`;
  }

  return normalizeValueSignature(candidate, aliasMap);
}

function isComparisonOperator(operator: string): boolean {
  return operator === '=' || operator === '<>' || operator === '!=' || operator === '>' || operator === '>=' || operator === '<' || operator === '<=' || operator === 'like' || operator === 'ilike' || operator === 'similar to' || operator === 'is' || operator === 'in';
}

function normalizeFunctionName(value: FunctionCall): string {
  const name = value.name instanceof RawString ? value.name.value : value.name.name;
  const namespaces = value.namespaces?.map((namespace) => normalizeIdentifier(namespace.name)) ?? [];
  return [...namespaces, normalizeIdentifier(name)].join('.');
}

function normalizeFunctionSignature(value: FunctionCall, aliasMap: Map<string, string>): string {
  const name = normalizeFunctionName(value);
  const args: string[] = [];

  if (value.argument) {
    args.push(normalizeValueSignature(value.argument, aliasMap));
  }

  if (value.filterCondition) {
    args.push(`filter:${normalizeValueSignature(value.filterCondition, aliasMap)}`);
  }

  return `fn:${name}(${args.join('|')})`;
}

function normalizeBooleanSignature(
  value: BinaryExpression,
  aliasMap: Map<string, string>,
  operator: 'and' | 'or'
): string {
  const operands = flattenBooleanOperands(value, operator).map((operand) => normalizeValueSignature(operand, aliasMap));
  return `${operator}(${operands.sort().join('|')})`;
}

function flattenBooleanOperands(value: ValueComponent, operator: 'and' | 'or'): ValueComponent[] {
  const candidate = unwrap(value);
  if (candidate instanceof BinaryExpression && normalizeIdentifier(candidate.operator.value) === operator) {
    return [
      ...flattenBooleanOperands(candidate.left, operator),
      ...flattenBooleanOperands(candidate.right, operator)
    ];
  }
  return [candidate];
}

function normalizeColumnReference(value: ColumnReference, aliasMap: Map<string, string>): string {
  const namespaces = value.namespaces?.map((namespace) => normalizeIdentifier(namespace.name)) ?? [];
  const column = normalizeIdentifier(value.column.name);

  if (namespaces.length === 0) {
    return column;
  }

  const aliasKey = namespaces.join('.');
  const resolved = aliasMap.get(aliasKey) ?? aliasMap.get(namespaces[0] ?? '');
  if (resolved) {
    return `${resolved}.${column}`;
  }

  return `${aliasKey}.${column}`;
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function literalKind(value: string | number | boolean | null): string {
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

function scoreSummaries(observed: ObservedSqlQuerySummary, candidate: ObservedSqlQuerySummary): ScoredPair {
  const observedProjectionTokens = observed.projectionTokens ?? [];
  const observedSourceTokens = observed.sourceTokens ?? [];
  const observedWhereTokens = observed.whereTokens ?? [];
  const observedWhereFamilies = observed.whereFamilies ?? [];
  const observedOrderTokens = observed.orderTokens ?? [];
  const observedPagingTokens = observed.pagingTokens ?? [];
  const observedSetOperationTokens = observed.setOperationTokens ?? [];

  const candidateProjectionTokens = candidate.projectionTokens ?? [];
  const candidateSourceTokens = candidate.sourceTokens ?? [];
  const candidateWhereTokens = candidate.whereTokens ?? [];
  const candidateWhereFamilies = candidate.whereFamilies ?? [];
  const candidateOrderTokens = candidate.orderTokens ?? [];
  const candidatePagingTokens = candidate.pagingTokens ?? [];
  const candidateSetOperationTokens = candidate.setOperationTokens ?? [];

  const projection = compareTokenSets(observedProjectionTokens, candidateProjectionTokens);
  const source = compareTokenSets(observedSourceTokens, candidateSourceTokens);
  const where = compareTokenSets(observedWhereTokens, candidateWhereTokens);
  const order = compareTokenSets(observedOrderTokens, candidateOrderTokens);
  const paging = comparePagingTokens(observedPagingTokens, candidatePagingTokens);
  const setOperation = compareTokenSets(observedSetOperationTokens, candidateSetOperationTokens);

  const score =
    projection.score * 33 +
    source.score * 30 +
    where.score * 18 +
    order.score * 6 +
    paging.score * 3 +
    setOperation.score * 10;

  const reasons: string[] = [];
  const differences: string[] = [];

  appendSectionNarrative('projection', projection, observedProjectionTokens, candidateProjectionTokens, reasons, differences);
  appendSectionNarrative('source graph', source, observedSourceTokens, candidateSourceTokens, reasons, differences);
  appendSectionNarrative('where clause', where, observedWhereTokens, candidateWhereTokens, reasons, differences);
  appendSectionNarrative('order by', order, observedOrderTokens, candidateOrderTokens, reasons, differences);
  appendPagingNarrative(observedPagingTokens, candidatePagingTokens, paging, reasons, differences);
  appendSectionNarrative('set operations', setOperation, observedSetOperationTokens, candidateSetOperationTokens, reasons, differences);

  if (candidateWhereFamilies.includes('optional-predicate') && !observedWhereFamilies.includes('optional-predicate')) {
    reasons.push('candidate preserves optional predicate branches that are absent from the observed statement');
  }

  if (candidateSetOperationTokens.length > 0 || observedSetOperationTokens.length > 0) {
    reasons.push('set operations were analyzed conservatively');
  }

  return {
    score: Number(Math.max(0, Math.min(100, score)).toFixed(1)),
    section_scores: {
      projection: projection.score,
      source: source.score,
      where: where.score,
      order: order.score,
      paging: paging.score
    },
    reasons: dedupeSorted(reasons),
    differences: dedupeSorted(differences)
  };
}

function compareTokenSets(observed: string[], candidate: string[]): { score: number; intersection: string[]; missing: string[]; extra: string[] } {
  const observedSet = new Set(observed);
  const candidateSet = new Set(candidate);
  const intersection = [...observedSet].filter((token) => candidateSet.has(token));
  const missing = [...observedSet].filter((token) => !candidateSet.has(token));
  const extra = [...candidateSet].filter((token) => !observedSet.has(token));
  const denominator = Math.max(observedSet.size, candidateSet.size, 1);
  return {
    score: intersection.length / denominator,
    intersection,
    missing,
    extra
  };
}

function comparePagingTokens(observed: string[], candidate: string[]): { score: number; intersection: string[]; missing: string[]; extra: string[] } {
  const observedSet = new Set(observed);
  const candidateSet = new Set(candidate);
  const intersection = [...observedSet].filter((token) => candidateSet.has(token));
  const missing = [...observedSet].filter((token) => !candidateSet.has(token));
  const extra = [...candidateSet].filter((token) => !observedSet.has(token));

  if (observedSet.size === 0 && candidateSet.size === 0) {
    return { score: 1, intersection, missing, extra };
  }

  if (observedSet.size === 0 && candidateSet.size > 0) {
    return { score: 0.6, intersection, missing, extra };
  }

  if (missing.length > 0) {
    return { score: intersection.length / Math.max(observedSet.size, 1) * 0.5, intersection, missing, extra };
  }

  return { score: 1, intersection, missing, extra };
}

function appendSectionNarrative(
  label: string,
  section: { score: number; intersection: string[]; missing: string[]; extra: string[] },
  observedTokens: string[],
  candidateTokens: string[],
  reasons: string[],
  differences: string[]
): void {
  const observed = observedTokens ?? [];
  const candidate = candidateTokens ?? [];

  if (observed.length === 0 && candidate.length === 0) {
    reasons.push(`${label} is absent in both statements`);
    return;
  }

  if (section.intersection.length === 0) {
    differences.push(`${label} differs completely`);
    if (observed.length > 0) {
      differences.push(`observed ${label}: ${observed.join(', ')}`);
    }
    if (candidate.length > 0) {
      differences.push(`candidate ${label}: ${candidate.join(', ')}`);
    }
    return;
  }

  if (section.missing.length === 0 && section.extra.length === 0) {
    reasons.push(`${label} matches exactly`);
    return;
  }

  if (section.missing.length === 0) {
    reasons.push(`${label} matches and the candidate is a superset`);
    differences.push(`candidate adds ${label}: ${section.extra.join(', ')}`);
    return;
  }

  reasons.push(`${label} partially matches`);
  differences.push(`missing ${label}: ${section.missing.join(', ')}`);
  if (section.extra.length > 0) {
    differences.push(`extra ${label}: ${section.extra.join(', ')}`);
  }
}

function appendPagingNarrative(
  observedTokens: string[],
  candidateTokens: string[],
  section: { score: number; intersection: string[]; missing: string[]; extra: string[] },
  reasons: string[],
  differences: string[]
): void {
  const observed = observedTokens ?? [];
  const candidate = candidateTokens ?? [];

  if (observed.length === 0 && candidate.length === 0) {
    reasons.push('paging is absent in both statements');
    return;
  }

  if (section.missing.length === 0 && section.extra.length === 0) {
    reasons.push('paging matches exactly');
    return;
  }

  if (section.missing.length === 0) {
    reasons.push('paging is present in the candidate as a superset');
    differences.push(`candidate adds paging: ${section.extra.join(', ')}`);
    return;
  }

  differences.push(`paging differs: observed ${formatTokenList(observed)}, candidate ${formatTokenList(candidate)}`);
}

function formatTokenList(tokens: string[]): string {
  return tokens.length === 0 ? '(none)' : tokens.join(', ');
}

function dedupeSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sortedValues(values: Set<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function unwrap(expression: ValueComponent): ValueComponent {
  let candidate = expression;
  while (candidate instanceof ParenExpression) {
    candidate = candidate.expression;
  }
  return candidate;
}

function isNullLiteral(value: ValueComponent): boolean {
  return value instanceof LiteralValue && value.value === null;
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
