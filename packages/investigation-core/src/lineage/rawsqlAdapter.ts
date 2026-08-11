import {
  BinarySelectQuery,
  CTECollector,
  CTEDependencyAnalyzer,
  CTEQueryDecomposer,
  ColumnReference,
  CreateTableQuery,
  FunctionSource,
  InsertQuery,
  InlineQuery,
  optimizeConditions as optimizeRawsqlConditions,
  ParenSource,
  SelectQueryParser,
  SelectOutputCollector,
  SimpleSelectQuery,
  SqlParser,
  SqlFormatter,
  SubQuerySource,
  TableSource,
  TableSourceCollector,
  ValuesQuery,
} from 'rawsql-ts';
import type { CommonTable, ConditionOptimizationResult, JoinClause, SelectQuery, SourceExpression, SqlComponent } from 'rawsql-ts';
import type {
  AnalysisWarning,
  LineageColumn,
  LineageCaseRule,
  LineageColumnRef,
  LineageUnresolvedColumnReference,
  LineageColumnUsageReason,
  LineageEdge,
  LineageExpressionTree,
  LineageModel,
  LineageNode,
  LineageNodeQueryDependencies,
  LineageScope,
  LineageSourceReference,
} from '../domain/lineage';
import { isSimpleColumnReference } from './columnDisplay';
import { attachNodeDependencyProfiles } from './nodeDependencyProfile';
import { collectPopulationScope } from './population-origin/collectPopulationScope';
import type { PopulationOriginDeps } from './population-origin/collectPopulationScope';
import type { SchemaFacts } from './schemaFacts';
import { createTableColumnResolver } from './schemaFacts';
import { mergeColumnRefs } from './source-references/mergeColumnRefs';
import { collectColumnReferences, resolveColumnReferences, resolveColumnReferencesWithIssues } from './source-references/resolveColumnReferences';
import type { SourceReferenceTarget } from './source-references/sourceReferences.types';

export interface ParserAdapterResult {
  conditionOptimization: ConditionOptimizationReport;
  lineage: LineageModel;
  parserVersion: string;
}

export interface AnalyzeSqlOptions {
  analysisMode?: SqlAnalysisMode;
  optimizeConditions?: boolean;
  schemaFacts?: SchemaFacts;
}

export type SqlAnalysisMode = 'debug_probes' | 'optimized' | 'original';

export interface ConditionOptimizationReport {
  applied: ConditionOptimizationReportItem[];
  appliedCount: number;
  blockedCount: number;
  changed: boolean;
  debugProbeCount: number;
  debugProbeSkippedCount: number;
  debugProbes: ConditionOptimizationReportItem[];
  debugSkippedProbes: ConditionOptimizationReportItem[];
  displayFailure?: ConditionOptimizationDisplayFailure;
  enabled: boolean;
  errorCount: number;
  errors: ConditionOptimizationReportItem[];
  mode: SqlAnalysisMode;
  ok: boolean;
  optimizedSql: string;
  originalSql: string;
  phases: ConditionOptimizationPhaseReport[];
  safety?: {
    dryRun: boolean;
    formatterGeneratedSource: boolean;
    mode: 'safe_only';
    unsafeRewriteApplied: boolean;
  };
  skipped: ConditionOptimizationReportItem[];
  skippedCount: number;
  unchangedAvailable: boolean;
  unchangedCount: number;
  warningCount: number;
  warnings: ConditionOptimizationReportItem[];
}

export interface ConditionOptimizationDisplayFailure {
  code: 'INPUT_FORMAT_FAILED' | 'OPTIMIZATION_FAILED' | 'OUTPUT_FORMAT_FAILED';
  message: string;
}

export interface ConditionOptimizationPhaseReport {
  appliedCount: number;
  errorCount: number;
  kind: string;
  skippedCount: number;
  warningCount: number;
}

export interface ConditionOptimizationReportItem {
  code?: string;
  conditionSql?: string;
  displaySql?: string;
  from?: string;
  kind?: string;
  parameterName?: string;
  phaseKind?: string;
  predicateSql?: string;
  probeKind?: string;
  reason?: string;
  status: 'blocked' | 'moved' | 'probe' | 'warning';
  suggestedSql?: string;
  target?: string;
  to?: string;
}

interface ParsedLineageSelectQuery {
  conditionOptimization: ConditionOptimizationReport;
  query: SelectQuery;
}

const parserVersion = 'rawsql-ts';
const appSqlFormatterOptions = {
  indentSize: 2,
  indentChar: 'space',
  newline: 'lf',
  keywordCase: 'lower',
  commaBreak: 'before',
  cteCommaBreak: 'after',
  valuesCommaBreak: 'before',
  andBreak: 'before',
  orBreak: 'before',
  joinOnBreak: 'before',
  joinConditionContinuationIndent: true,
  exportComment: 'none',
  commentStyle: 'smart',
  withClauseStyle: 'standard',
  parenthesesOneLine: true,
  indentNestedParentheses: true,
  betweenOneLine: true,
  inOneLine: true,
  valuesOneLine: true,
  joinOneLine: true,
  caseOneLine: true,
  subqueryOneLine: true,
  insertColumnsOneLine: true,
  whenOneLine: true,
  oneLineMaxLength: 40,
  joinConditionOrderByDeclaration: true,
  orderByDefaultDirectionStyle: 'omit',
  columnAliasStyle: 'explicit',
  constraintStyle: 'postgres',
  identifierEscape: 'none',
  identifierEscapeTarget: 'minimal',
  parameterSymbol: ':',
  parameterStyle: 'original',
  sourceAliasStyle: 'explicit',
  castStyle: 'standard',
} as const;
const expressionFormatterOptions = {
  ...appSqlFormatterOptions,
  sourceAliasStyle: appSqlFormatterOptions.sourceAliasStyle === 'explicit' ? 'as' : appSqlFormatterOptions.sourceAliasStyle,
};
const expressionFormatter = new SqlFormatter(expressionFormatterOptions as unknown as ConstructorParameters<typeof SqlFormatter>[0]);
const nodeSqlFormatter = new SqlFormatter({
  ...appSqlFormatterOptions,
  exportComment: 'full',
  sourceAliasStyle: appSqlFormatterOptions.sourceAliasStyle === 'explicit' ? 'as' : appSqlFormatterOptions.sourceAliasStyle,
  withClauseStyle: 'standard',
} as unknown as ConstructorParameters<typeof SqlFormatter>[0]);

function parseLineageSelectQuery(sql: string, analysisMode: SqlAnalysisMode): ParsedLineageSelectQuery {
  const wrappedSelectSql = extractWrappedSelectSql(sql);
  if (wrappedSelectSql) {
    return parseLineageSelectQuery(wrappedSelectSql, analysisMode);
  }

  const originalStatement = parseSqlOrUndefined(sql);
  const optimization = optimizeLineageSelectSql(sql, analysisMode);
  let statement: unknown;
  try {
    statement = SqlParser.parse(optimization.sql);
    restoreLineageComments(statement, originalStatement);
  } catch (error) {
    throw error;
  }

  const report = optimization.report;

  if (statement instanceof CreateTableQuery) {
    if (!statement.asSelectQuery) {
      throw new Error('CREATE TABLE lineage requires an AS SELECT query.');
    }
    return { conditionOptimization: finalizeConditionOptimizationDisplayReport(report, sql), query: statement.asSelectQuery };
  }

  if (statement instanceof InsertQuery) {
    if (!statement.selectQuery || statement.selectQuery instanceof ValuesQuery) {
      throw new Error('INSERT lineage requires a SELECT query.');
    }
    const originalSelectQuery = originalStatement instanceof InsertQuery && isSelectQuery(originalStatement.selectQuery)
      ? originalStatement.selectQuery
      : statement.selectQuery;
    const optimizedSelect = optimizeLineageSelectQuery(statement.selectQuery, originalSelectQuery, analysisMode);
    return {
      conditionOptimization: finalizeConditionOptimizationDisplayReport(
        mergeConditionOptimizationReports(report, optimizedSelect.conditionOptimization),
        sql,
        cloneInsertQueryWithSelect(statement, optimizedSelect.query),
      ),
      query: optimizedSelect.query,
    };
  }

  if (isSelectQuery(statement)) {
    return { conditionOptimization: finalizeConditionOptimizationDisplayReport(report, sql), query: statement };
  }

  throw new Error('Only SELECT, CREATE TABLE AS SELECT, CREATE VIEW AS SELECT, and INSERT SELECT statements are supported.');
}

function optimizeLineageSelectSql(sql: string, analysisMode: SqlAnalysisMode): { report: ConditionOptimizationReport; sql: string } {
  if (analysisMode === 'original') {
    return { report: createDisabledConditionOptimizationReport(sql), sql };
  }
  const result = optimizeRawsqlConditions(sql);
  const optimizedSql = result.ok ? result.sql : sql;
  const analysisSql = analysisMode === 'debug_probes' && result.ok
    ? result.diagnostics?.debugSql ?? optimizedSql
    : optimizedSql;
  return {
    report: toConditionOptimizationReport(analysisMode, result, sql, analysisSql),
    sql: analysisSql,
  };
}

function optimizeLineageSelectQuery(
  query: SelectQuery,
  commentSource: SelectQuery,
  analysisMode: SqlAnalysisMode,
): ParsedLineageSelectQuery {
  if (analysisMode === 'original') {
    return { conditionOptimization: createDisabledConditionOptimizationReport(), query };
  }
  const result = optimizeRawsqlConditions(query);
  if (!result.ok) {
    return { conditionOptimization: toConditionOptimizationReport(analysisMode, result, '', result.sql), query };
  }

  const analysisSql = analysisMode === 'debug_probes'
    ? result.diagnostics?.debugSql ?? result.sql
    : result.sql;
  const optimized = SqlParser.parse(analysisSql);
  restoreLineageComments(optimized, commentSource);
  return {
    conditionOptimization: toConditionOptimizationReport(analysisMode, result, '', analysisSql),
    query: isSelectQuery(optimized) ? optimized : query,
  };
}

export function finalizeConditionOptimizationDisplayReport(
  report: ConditionOptimizationReport,
  originalSql: string,
  optimizedQuery?: unknown,
): ConditionOptimizationReport {
  const originalDisplay = formatSqlForOptimizationDisplay(originalSql, 'Input SQL');
  const originalDisplaySql = originalDisplay.sql;
  if (originalDisplay.failure) {
    return withConditionOptimizationSql(
      {
        ...report,
        displayFailure: {
          code: 'INPUT_FORMAT_FAILED',
          message: originalDisplay.failure,
        },
      },
      originalDisplaySql,
      originalDisplaySql,
    );
  }
  if (!report.enabled) {
    return withConditionOptimizationSql(report, originalDisplaySql, originalDisplaySql);
  }

  if (!report.ok) {
    return withConditionOptimizationSql(
      {
        ...report,
        displayFailure: {
          code: 'OPTIMIZATION_FAILED',
          message: optimizationFailureMessage(report),
        },
      },
      originalDisplaySql,
      originalDisplaySql,
    );
  }

  const optimizedDisplay = optimizedQuery
    ? formatQueryForOptimizationDisplay(optimizedQuery, 'Output SQL', originalSql)
    : formatSqlForOptimizationDisplay(report.optimizedSql, 'Output SQL', originalSql);
  if (optimizedDisplay.failure) {
    return withConditionOptimizationSql(
      {
        ...report,
        displayFailure: {
          code: 'OUTPUT_FORMAT_FAILED',
          message: optimizedDisplay.failure,
        },
      },
      originalDisplaySql,
      originalDisplaySql,
    );
  }

  return withConditionOptimizationSql(report, originalDisplaySql, optimizedDisplay.sql);
}

function formatSqlForOptimizationDisplay(
  sql: string,
  label: 'Input SQL' | 'Output SQL',
  commentSourceSql?: string,
): { failure?: string; sql: string } {
  const parsedSql = parseSqlForOptimizationDisplay(sql);
  if (parsedSql.failure) {
    return { failure: `${label} could not be parsed for display: ${parsedSql.failure}`, sql: sql.trim() };
  }

  return formatQueryForOptimizationDisplay(parsedSql.query, label, commentSourceSql, sql.trim());
}

function formatQueryForOptimizationDisplay(
  query: unknown,
  label: 'Input SQL' | 'Output SQL',
  commentSourceSql?: string,
  fallbackSql = '',
): { failure?: string; sql: string } {
  if (commentSourceSql) {
    const commentSource = parseSqlOrUndefined(commentSourceSql);
    if (commentSource) {
      restoreLineageComments(query, commentSource);
    }
  }

  const formattedSql = formatNodeQuerySqlWithError(query);
  if (formattedSql.failure || !formattedSql.sql) {
    return {
      failure: `${label} could not be formatted for display: ${formattedSql.failure ?? 'The formatter returned no SQL.'}`,
      sql: fallbackSql,
    };
  }
  return { sql: formattedSql.sql };
}

function cloneInsertQueryWithSelect(statement: InsertQuery, selectQuery: SelectQuery): InsertQuery {
  return Object.assign(Object.create(Object.getPrototypeOf(statement)), statement, { selectQuery }) as InsertQuery;
}

function parseSqlForOptimizationDisplay(sql: string): { failure?: string; query?: unknown } {
  try {
    return { query: SqlParser.parse(sql) };
  } catch (error) {
    return { failure: errorMessage(error) };
  }
}

function optimizationFailureMessage(report: ConditionOptimizationReport): string {
  const reasons = [...report.errors, ...report.skipped]
    .map((item) => item.reason ?? item.code)
    .filter((reason): reason is string => Boolean(reason));
  return reasons.length > 0
    ? `Optimization failed. ${reasons.join(' ')}`
    : 'Optimization failed. The optimizer did not return a usable SQL result.';
}

function createDisabledConditionOptimizationReport(sql = ''): ConditionOptimizationReport {
  return {
    applied: [],
    appliedCount: 0,
    blockedCount: 0,
    changed: false,
    debugProbeCount: 0,
    debugProbeSkippedCount: 0,
    debugProbes: [],
    debugSkippedProbes: [],
    enabled: false,
    errorCount: 0,
    errors: [],
    mode: 'original',
    ok: true,
    optimizedSql: sql,
    originalSql: sql,
    phases: [],
    skipped: [],
    skippedCount: 0,
    unchangedAvailable: false,
    unchangedCount: 0,
    warningCount: 0,
    warnings: [],
  };
}

function toConditionOptimizationReport(
  mode: Exclude<SqlAnalysisMode, 'original'>,
  result: ConditionOptimizationResult,
  originalSql: string,
  optimizedSql: string,
): ConditionOptimizationReport {
  const sourceFilterProbes = result.diagnostics?.probes.map(toSourceFilterProbeReportItem) ?? [];
  const skippedSourceFilterProbes = result.diagnostics?.skippedProbes.map(toSkippedSourceFilterProbeReportItem) ?? [];
  return {
    applied: result.applied.map((item) => toConditionOptimizationReportItem(item, 'moved')),
    appliedCount: result.applied.length,
    blockedCount: result.skipped.length + result.errors.length,
    changed: normalizedSqlForCompare(originalSql) !== normalizedSqlForCompare(optimizedSql),
    debugProbeCount: sourceFilterProbes.length,
    debugProbeSkippedCount: skippedSourceFilterProbes.length,
    debugProbes: sourceFilterProbes,
    debugSkippedProbes: skippedSourceFilterProbes,
    enabled: true,
    errorCount: result.errors.length,
    errors: result.errors.map((item) => toConditionOptimizationReportItem(item, 'blocked')),
    mode,
    ok: result.ok,
    optimizedSql,
    originalSql,
    phases: result.phases.map((phase) => ({
      appliedCount: phase.appliedCount,
      errorCount: phase.errorCount,
      kind: phase.kind,
      skippedCount: phase.skippedCount,
      warningCount: phase.warningCount,
    })),
    safety: {
      dryRun: result.safety.dryRun,
      formatterGeneratedSource: result.safety.formatterGeneratedSource,
      mode: result.safety.mode,
      unsafeRewriteApplied: result.safety.unsafeRewriteApplied,
    },
    skipped: result.skipped.map((item) => toConditionOptimizationReportItem(item, 'blocked')),
    skippedCount: result.skipped.length,
    unchangedAvailable: false,
    unchangedCount: 0,
    warningCount: result.warnings.length,
    warnings: result.warnings.map((item) => toConditionOptimizationReportItem(item, 'warning')),
  };
}

function mergeConditionOptimizationReports(
  left: ConditionOptimizationReport,
  right: ConditionOptimizationReport,
): ConditionOptimizationReport {
  if (!left.enabled) {
    return left;
  }
  if (!right.enabled) {
    return left;
  }
  return {
    applied: [...left.applied, ...right.applied],
    appliedCount: left.appliedCount + right.appliedCount,
    blockedCount: left.blockedCount + right.blockedCount,
    changed: left.changed || right.changed,
    debugProbeCount: left.debugProbeCount + right.debugProbeCount,
    debugProbeSkippedCount: left.debugProbeSkippedCount + right.debugProbeSkippedCount,
    debugProbes: [...left.debugProbes, ...right.debugProbes],
    debugSkippedProbes: [...left.debugSkippedProbes, ...right.debugSkippedProbes],
    enabled: true,
    errorCount: left.errorCount + right.errorCount,
    errors: [...left.errors, ...right.errors],
    mode: left.mode === 'debug_probes' || right.mode === 'debug_probes' ? 'debug_probes' : 'optimized',
    ok: left.ok && right.ok,
    optimizedSql: right.optimizedSql || left.optimizedSql,
    originalSql: left.originalSql || right.originalSql,
    phases: [...left.phases, ...right.phases],
    safety: right.safety ?? left.safety,
    skipped: [...left.skipped, ...right.skipped],
    skippedCount: left.skippedCount + right.skippedCount,
    unchangedAvailable: left.unchangedAvailable || right.unchangedAvailable,
    unchangedCount: left.unchangedCount + right.unchangedCount,
    warningCount: left.warningCount + right.warningCount,
    warnings: [...left.warnings, ...right.warnings],
  };
}

function toConditionOptimizationReportItem(
  item: unknown,
  status: ConditionOptimizationReportItem['status'],
): ConditionOptimizationReportItem {
  if (!item || typeof item !== 'object') {
    return { status };
  }
  const record = item as Record<string, unknown>;
  const conditionSql = typeof record.conditionSql === 'string' ? normalizeDisplaySql(record.conditionSql) : undefined;
  const predicateSql = typeof record.predicateSql === 'string' ? normalizeDisplaySql(record.predicateSql) : undefined;
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    conditionSql,
    displaySql: conditionSql ?? predicateSql,
    from: typeof record.fromScopeId === 'string' ? normalizeOptimizationScope(record.fromScopeId) : typeof record.scopeId === 'string' ? normalizeOptimizationScope(record.scopeId) : undefined,
    kind: typeof record.kind === 'string' ? record.kind : undefined,
    parameterName: typeof record.parameterName === 'string' ? record.parameterName : undefined,
    phaseKind: typeof record.phaseKind === 'string' ? record.phaseKind : undefined,
    predicateSql,
    reason: typeof record.reason === 'string' ? record.reason : typeof record.message === 'string' ? record.message : undefined,
    status,
    to: typeof record.toScopeId === 'string' ? normalizeOptimizationScope(record.toScopeId) : undefined,
  };
}

function toSourceFilterProbeReportItem(item: {
  predicate: string;
  reason: string;
  relation?: string;
  source: string;
  sourceAlias: string;
  suggestedSql: string;
}): ConditionOptimizationReportItem {
  return {
    displaySql: normalizeDisplaySql(item.predicate),
    predicateSql: normalizeDisplaySql(item.predicate),
    probeKind: item.relation ?? 'source_filter',
    reason: item.reason,
    status: 'probe',
    suggestedSql: item.suggestedSql.trim(),
    target: item.sourceAlias || item.source,
    to: item.sourceAlias || item.source,
  };
}

function toSkippedSourceFilterProbeReportItem(item: {
  code: string;
  predicate: string;
  reason: string;
  source?: string;
  sourceAlias?: string;
}): ConditionOptimizationReportItem {
  return {
    code: item.code,
    displaySql: normalizeDisplaySql(item.predicate),
    predicateSql: normalizeDisplaySql(item.predicate),
    probeKind: 'source_filter',
    reason: item.reason,
    status: 'blocked',
    target: item.sourceAlias ?? item.source,
    to: item.sourceAlias ?? item.source,
  };
}

function withConditionOptimizationSql(
  report: ConditionOptimizationReport,
  originalSql: string,
  optimizedSql: string,
): ConditionOptimizationReport {
  return {
    ...report,
    changed: report.enabled && normalizedSqlForCompare(originalSql) !== normalizedSqlForCompare(optimizedSql),
    optimizedSql,
    originalSql,
  };
}

function normalizeDisplaySql(sql: string): string {
  return sql.replace(/"/g, '');
}

function normalizeOptimizationScope(scopeId: string): string {
  if (scopeId === 'scope:root') {
    return 'final SELECT WHERE';
  }
  if (scopeId.startsWith('table:')) {
    return scopeId.slice('table:'.length);
  }
  if (scopeId.startsWith('cte:')) {
    return `${scopeId.slice('cte:'.length)} CTE WHERE`;
  }
  if (scopeId.startsWith('scope_')) {
    return scopeId.replace(/^scope_/, '').replace(/_/g, ' ');
  }
  return scopeId;
}

function normalizedSqlForCompare(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function parseSqlOrUndefined(sql: string): unknown {
  try {
    return SqlParser.parse(sql);
  } catch {
    return undefined;
  }
}

function restoreLineageComments(target: unknown, source: unknown): void {
  if (!target || !source || typeof target !== 'object' || typeof source !== 'object') {
    return;
  }

  copyCommentMetadata(target, source);
  if (target instanceof CreateTableQuery && source instanceof CreateTableQuery) {
    restoreLineageComments(target.asSelectQuery, source.asSelectQuery);
    return;
  }
  if (target instanceof InsertQuery && source instanceof InsertQuery) {
    restoreLineageComments(target.selectQuery, source.selectQuery);
    return;
  }
  if (target instanceof SimpleSelectQuery && source instanceof SimpleSelectQuery) {
    restoreSimpleSelectComments(target, source);
    return;
  }
  if (target instanceof BinarySelectQuery && source instanceof BinarySelectQuery) {
    restoreLineageComments(target.left, source.left);
    restoreLineageComments(target.right, source.right);
  }
}

function restoreSimpleSelectComments(target: SimpleSelectQuery, source: SimpleSelectQuery): void {
  copyCommentMetadata(target.selectClause, source.selectClause);
  copySelectItemComments(target.selectClause.items, source.selectClause.items);
  copyCommentMetadata(target.fromClause, source.fromClause);
  copyCommentMetadata(target.whereClause, source.whereClause);
  copyCommentMetadata(target.groupByClause, source.groupByClause);
  copyCommentMetadata(target.havingClause, source.havingClause);
  copyCommentMetadata(target.orderByClause, source.orderByClause);
  copyCommentMetadata(target.limitClause, source.limitClause);
  copyCommentMetadata(target.offsetClause, source.offsetClause);
  copyCteComments(target.withClause?.tables, source.withClause?.tables);
}

function copyCteComments(targetCtes: CommonTable[] | undefined | null, sourceCtes: CommonTable[] | undefined | null): void {
  if (!targetCtes?.length || !sourceCtes?.length) {
    return;
  }

  const sourceByName = new Map(sourceCtes.map((cte) => [cte.getSourceAliasName().toLowerCase(), cte]));
  for (const targetCte of targetCtes) {
    const sourceCte = sourceByName.get(targetCte.getSourceAliasName().toLowerCase());
    if (!sourceCte) {
      continue;
    }
    copyCommentMetadata(targetCte, sourceCte);
    copyCommentMetadata(targetCte.aliasExpression, sourceCte.aliasExpression);
    copyCommentMetadata(targetCte.aliasExpression?.table, sourceCte.aliasExpression?.table);
    restoreLineageComments(targetCte.query, sourceCte.query);
  }
}

function copySelectItemComments(targetItems: SimpleSelectQuery['selectClause']['items'], sourceItems: SimpleSelectQuery['selectClause']['items']): void {
  for (let index = 0; index < targetItems.length && index < sourceItems.length; index += 1) {
    const targetItem = targetItems[index] as CommentMetadataCarrier;
    const sourceItem = sourceItems[index] as CommentMetadataCarrier;
    copyCommentMetadata(targetItem, sourceItem);
    copyCommentMetadata(targetItems[index].value, sourceItems[index].value);
    copyCommentMetadata(targetItems[index].identifier, sourceItems[index].identifier);
    copyCommentField(targetItem, sourceItem, 'aliasPositionedComments');
  }
}

type CommentMetadataCarrier = {
  comments?: unknown;
  positionedComments?: unknown;
  trailingComments?: unknown;
  globalComments?: unknown;
  headerComments?: unknown;
  aliasPositionedComments?: unknown;
};

function copyCommentMetadata(target: unknown, source: unknown): void {
  if (!target || !source || typeof target !== 'object' || typeof source !== 'object') {
    return;
  }
  copyCommentField(target as CommentMetadataCarrier, source as CommentMetadataCarrier, 'comments');
  copyCommentField(target as CommentMetadataCarrier, source as CommentMetadataCarrier, 'positionedComments');
  copyCommentField(target as CommentMetadataCarrier, source as CommentMetadataCarrier, 'trailingComments');
  copyCommentField(target as CommentMetadataCarrier, source as CommentMetadataCarrier, 'globalComments');
  copyCommentField(target as CommentMetadataCarrier, source as CommentMetadataCarrier, 'headerComments');
}

function copyCommentField(target: CommentMetadataCarrier, source: CommentMetadataCarrier, field: keyof CommentMetadataCarrier): void {
  const value = source[field];
  if (value !== undefined && value !== null) {
    target[field] = value;
  }
}

function isSelectQuery(value: unknown): value is SelectQuery {
  return value instanceof SimpleSelectQuery || value instanceof BinarySelectQuery || value instanceof ValuesQuery;
}

function extractWrappedSelectSql(sql: string): string | undefined {
  const match = sql.match(/^\s*(?:(?:--[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)\s*)*create\s+(?:or\s+replace\s+)?(?:(?:temporary|temp)\s+)?(?:(?:materialized)\s+)?(?:table|view)\b[\s\S]*?\bas\s+([\s\S]+?)\s*;?\s*$/i);
  return match?.[1]?.trim();
}

export function analyzeSql(sql: string, options: AnalyzeSqlOptions = {}): ParserAdapterResult {
  const warnings: AnalysisWarning[] = [...(options.schemaFacts?.diagnostics ?? []).map((diagnostic) => ({
    code: diagnostic.code,
    message: diagnostic.filePath ? `${diagnostic.message} (${diagnostic.filePath})` : diagnostic.message,
  }))];
  const nodes = new Map<string, LineageNode>();
  const edges: LineageEdge[] = [];
  const scopes: LineageScope[] = [];
  const derivedCounter = { value: 0 };
  const scalarSubqueryCounter = { value: 0 };
  const scopeCounter = { value: 0 };
  const analysisMode = resolveSqlAnalysisMode(options);

  let query: SelectQuery;
  let conditionOptimization: ConditionOptimizationReport;
  try {
    const parsed = parseLineageSelectQuery(sql, analysisMode);
    query = parsed.query;
    conditionOptimization = parsed.conditionOptimization;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }

  nodes.set('main_output', {
    id: 'main_output',
    type: 'output',
    label: 'Final Result',
    columns: [],
    comments: extractQueryNodeComments(query),
  });

  const ctes = new CTECollector().collect(query);
  const cteNames = new Set(ctes.map((cte) => cte.getSourceAliasName()));
  const cteCommentsByName = new Map(ctes.map((cte) => [cte.getSourceAliasName(), extractCteComments(cte)]));
  const cteExecutableSqlByName = collectCteExecutableSql(query, ctes, warnings, cteCommentsByName);
  const queryDependencyMap = collectRawsqlQueryDependencies(query, ctes);

  nodes.get('main_output')!.queryDependencies = queryDependencyMap.get('main_output');

  for (const cte of ctes) {
    const cteName = cte.getSourceAliasName();
    const nodeId = isParameterSelectQuery(cte.query) ? toParameterTableId(cteName) : toCteId(cteName);
    nodes.set(nodeId, {
      id: nodeId,
      type: isParameterSelectQuery(cte.query) ? 'parameter_table' : 'cte',
      label: cteName,
      columns: [],
      comments: cteCommentsByName.get(cteName),
      cteExecutableSql: cteExecutableSqlByName.get(cteName),
      queryDependencies: queryDependencyMap.get(nodeId),
      materializationHint: isParameterSelectQuery(cte.query) ? undefined : normalizeMaterializationHint(cte.materialized),
      querySql: cteExecutableSqlByName.get(cteName),
    });
  }

  for (const cte of ctes) {
    const targetId = isParameterSelectQuery(cte.query) ? toParameterTableId(cte.getSourceAliasName()) : toCteId(cte.getSourceAliasName());
    collectQueryEdges({
      query: cte.query,
      targetId,
      targetLabel: cte.getSourceAliasName(),
      recursiveRootId: targetId,
      cteNames,
      nodes,
      edges,
      scopes,
      warnings,
      derivedCounter,
      scalarSubqueryCounter,
      scopeCounter,
      schemaFacts: options.schemaFacts,
    });
  }

  collectQueryEdges({
    query,
    targetId: 'main_output',
    targetLabel: 'Final Result',
    cteNames,
    nodes,
    edges,
    scopes,
    warnings,
    derivedCounter,
    scalarSubqueryCounter,
    scopeCounter,
    schemaFacts: options.schemaFacts,
  });
  nodes.get('main_output')!.querySql = formatOutputQuerySql(query, cteCommentsByName);

  classifyColumnUsage(nodes);

  const dedupedEdges = dedupeEdges(edges);
  warnings.push(...collectUnusedCteWarnings([...nodes.values()], dedupedEdges));

  const lineage: LineageModel = attachNodeDependencyProfiles({
    kind: 'sql-lineage-model',
    modelVersion: 1,
    nodes: [...nodes.values()],
    edges: dedupedEdges,
    scopes,
    analysisWarnings: warnings,
    raw: {
      adapter: 'rawsql-ts-ast',
    },
  });

  return {
    conditionOptimization,
    lineage,
    parserVersion,
  };
}

function collectRawsqlQueryDependencies(query: SelectQuery, ctes: CommonTable[]): Map<string, LineageNodeQueryDependencies> {
  const dependencies = new Map<string, LineageNodeQueryDependencies>();
  const cteNames = new Set(ctes.map((cte) => cte.getSourceAliasName()));
  const cteDependencyGraph = query instanceof SimpleSelectQuery ? new CTEDependencyAnalyzer().analyzeDependencies(query) : undefined;
  const cteDependenciesByName = new Map(cteDependencyGraph?.nodes.filter((node) => node.type === 'CTE').map((node) => [node.name, node.dependencies]) ?? []);
  const mainCteDependencies = cteDependencyGraph?.nodes.find((node) => node.type === 'ROOT')?.dependencies ?? [];

  dependencies.set('main_output', {
    directCteNames: uniqueStrings(mainCteDependencies),
    directTableNames: query instanceof SimpleSelectQuery ? collectPhysicalTableNames(cloneSelectQueryWithoutCtes(query), cteNames) : collectPhysicalTableNames(query, cteNames),
  });

  for (const cte of ctes) {
    const cteName = cte.getSourceAliasName();
    dependencies.set(isParameterSelectQuery(cte.query) ? toParameterTableId(cteName) : toCteId(cteName), {
      directCteNames: uniqueStrings(cteDependenciesByName.get(cteName) ?? []),
      directTableNames: collectPhysicalTableNames(cte.query, cteNames),
    });
  }

  return dependencies;
}

function collectPhysicalTableNames(query: SqlComponent, cteNames: Set<string>): string[] {
  return uniqueStrings(
    new TableSourceCollector(false)
      .collect(query)
      .map((table) => table.getSourceName())
      .filter((tableName) => !cteNames.has(tableName)),
  );
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function resolveSqlAnalysisMode(options: AnalyzeSqlOptions): SqlAnalysisMode {
  if (options.analysisMode) {
    return options.analysisMode;
  }
  if (options.optimizeConditions === false) {
    return 'original';
  }
  if (options.optimizeConditions === true) {
    return 'optimized';
  }
  return 'optimized';
}

function collectUnusedCteWarnings(nodes: LineageNode[], edges: LineageEdge[]): AnalysisWarning[] {
  const outputNodeIds = nodes.filter((node) => node.type === 'output').map((node) => node.id);
  const reachableNodeIds = collectUpstreamReachableNodeIds(outputNodeIds, edges);

  return nodes
    .filter((node) => node.type === 'cte' && !reachableNodeIds.has(node.id))
    .map((node) => ({
      code: 'unused_cte',
      message: `CTE "${node.label}" is not reachable from the final output.`,
    }));
}

function collectUpstreamReachableNodeIds(rootNodeIds: string[], edges: LineageEdge[]): Set<string> {
  const reachable = new Set(rootNodeIds);
  const incomingByTarget = new Map<string, LineageEdge[]>();

  for (const edge of edges) {
    if (edge.type !== 'dataFlow' || edge.recursive || edge.source === edge.target) {
      continue;
    }
    incomingByTarget.set(edge.target, [...(incomingByTarget.get(edge.target) ?? []), edge]);
  }

  const queue = [...rootNodeIds];
  while (queue.length > 0) {
    const targetId = queue.shift()!;
    for (const edge of incomingByTarget.get(targetId) ?? []) {
      if (!reachable.has(edge.source)) {
        reachable.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  return reachable;
}

interface CollectQueryEdgesOptions {
  query: unknown;
  targetId: string;
  targetLabel: string;
  recursiveRootId?: string;
  cteNames: Set<string>;
  nodes: Map<string, LineageNode>;
  edges: LineageEdge[];
  scopes: LineageScope[];
  warnings: AnalysisWarning[];
  derivedCounter: { value: number };
  scalarSubqueryCounter: { value: number };
  scopeCounter: { value: number };
  parentScopeId?: string;
  schemaFacts?: SchemaFacts;
}

interface ResolvedSource {
  node: LineageNode;
  aliases: string[];
  sourceAlias?: string;
  recursive?: boolean;
  wildcardPassthroughSource?: {
    aliases: string[];
    node: LineageNode;
    sourceAlias?: string;
  };
}

interface OutputColumnDeps {
  addWarning: (warning: AnalysisWarning) => void;
  collectExpressionBreakdownRules: (value: unknown, sources: ResolvedSource[]) => LineageCaseRule[] | undefined;
  collectExpressionTree: (value: unknown, sources: ResolvedSource[]) => LineageExpressionTree | undefined;
  collectNestedExpressionLineage: (value: unknown) => LineageColumnRef[];
  collectScalarSubqueryLineage: (value: unknown, ownerOutputColumnName: string, outerSources: ResolvedSource[], parentScopeId: string) => LineageColumnRef[];
  extractSelectItemComments: (items: SimpleSelectQuery['selectClause']['items'], index: number) => string[] | undefined;
  formatExpressionSql: (value: unknown) => string | undefined;
  recordUnresolvedColumnWarnings: (unresolved: LineageUnresolvedColumnReference[], scopeId: string, outputColumnName: string) => void;
  schemaFacts?: SchemaFacts;
  setNodeColumns: (nodeId: string, columns: Array<string | LineageColumn>) => void;
}

function toSourceReferenceTargets(sources: ResolvedSource[]): SourceReferenceTarget[] {
  return sources.map((source) => ({
    aliases: source.aliases,
    columnNames: source.node.columns.map((column) => column.name),
    nodeId: source.node.id,
    nodeType: source.node.type,
  }));
}

function collectQueryEdges(options: CollectQueryEdgesOptions): void {
  const { query, targetId, targetLabel, cteNames, nodes, edges, scopes, warnings, derivedCounter, recursiveRootId, parentScopeId } = options;

  if (query instanceof SimpleSelectQuery) {
    const fromClause = query.fromClause;
    const scopeId = nextScopeId(options, targetId);
    if (!fromClause) {
      const outputColumns = collectOutputColumns(query, [], createOutputColumnDeps(options), scopeId);
      scopes.push(collectPopulationScope({
        deps: createPopulationOriginDeps(options),
        joins: [],
        outputColumns,
        parentScopeId,
        query,
        scopeId,
        sources: [],
        targetId,
        targetLabel,
      }));
      setNodeColumns(nodes, targetId, outputColumns);
      if (nodes.get(targetId)?.type !== 'parameter_table') {
        const parameterSource = createParameterTableNode('parameters', nodes);
        addLineageEdge(edges, {
          source: parameterSource.id,
          target: targetId,
          type: 'dataFlow',
          kind: 'value_flow',
          sourceAlias: 'parameters',
          confidence: 'high',
        });
      }
      return;
    }

    const sources = [
      resolveSourceExpression(fromClause.source, cteNames, nodes, edges, scopes, warnings, derivedCounter, options.scalarSubqueryCounter, options.scopeCounter, recursiveRootId, options.schemaFacts),
    ];
    const joins = fromClause.joins ?? [];

    for (const source of sources) {
      addLineageEdge(edges, {
        source: source.node.id,
        target: targetId,
        type: 'dataFlow',
        kind: nodes.get(targetId)?.type === 'scalar_subquery' ? 'row_source' : 'value_flow',
        sourceAlias: source.sourceAlias,
        recursive: source.recursive ? { reason: 'cteSelfReference' } : undefined,
        confidence: 'high',
      });
    }

    for (const join of joins) {
      const joinedSource = resolveSourceExpression(join.source, cteNames, nodes, edges, scopes, warnings, derivedCounter, options.scalarSubqueryCounter, options.scopeCounter, recursiveRootId, options.schemaFacts);
      const joinType = normalizeJoinType(join);
      sources.push(joinedSource);

      addLineageEdge(edges, {
        source: joinedSource.node.id,
        target: targetId,
        type: 'dataFlow',
        kind: nodes.get(targetId)?.type === 'scalar_subquery' ? 'row_source' : 'value_flow',
        label: normalizeJoinLabel(join),
        sourceAlias: joinedSource.sourceAlias,
        joinNullability: toJoinNullability(joinType),
        recursive: joinedSource.recursive ? { reason: 'cteSelfReference' } : undefined,
        confidence: 'high',
      });
    }

    const outputColumns = collectOutputColumns(query, sources, createOutputColumnDeps(options), scopeId);
    scopes.push(collectPopulationScope({
      deps: createPopulationOriginDeps(options),
      joins,
      outputColumns,
      parentScopeId,
      query,
      scopeId,
      sources,
      targetId,
      targetLabel,
    }));
    setNodeColumns(nodes, targetId, outputColumns);
    setValueSourceColumns(outputColumns, nodes);
    setReferencedSourceColumns(query, sources, warnings, scopeId);
    collectNestedConditionLineage(query, options);

    return;
  }

  if (query instanceof BinarySelectQuery) {
    const operator = query.operator.value.toUpperCase();
    const parts = collectBinaryParts(query, operator);
    if (parts.length > 2) {
      const partIds = parts.map((part, index) => collectBinaryPart(part, `part_${index + 1}`, operator, options));
      for (const partId of partIds) {
        addLineageEdge(edges, {
          source: partId,
          target: targetId,
          type: 'dataFlow',
          label: operator,
          confidence: 'medium',
        });
      }
      setNodeColumns(nodes, targetId, collectBinaryOutputColumnsFromParts(query, partIds, nodes));
      return;
    }

    const leftId = collectBinaryPart(query.left, 'left', operator, options);
    const rightId = collectBinaryPart(query.right, 'right', operator, options);
    addLineageEdge(edges, {
      source: leftId,
      target: targetId,
      type: 'dataFlow',
      label: operator,
      confidence: 'medium',
    });
    addLineageEdge(edges, {
      source: rightId,
      target: targetId,
      type: 'dataFlow',
      label: operator,
      confidence: 'medium',
    });
    setNodeColumns(nodes, targetId, collectBinaryOutputColumns(query, leftId, rightId, nodes));
    return;
  }

  warnings.push({
    code: 'unsupported-query-kind',
    message: `${targetLabel} uses a query kind that the MVP lineage adapter does not support yet.`,
  });
}

function collectBinaryPart(query: unknown, side: string, operator: string, options: CollectQueryEdgesOptions): string {
  const { nodes, derivedCounter } = options;
  derivedCounter.value += 1;
  const id = `derived_${operator.toLowerCase().replace(/\s+/g, '_')}_${side}_${derivedCounter.value}`;
  nodes.set(id, {
    id,
    type: 'derived',
    label: `${operator} ${side}`,
    columns: [],
    comments: extractQueryNodeComments(query),
    querySql: formatStandaloneQuerySql(query),
  });
  collectQueryEdges({ ...options, query, targetId: id, targetLabel: `${operator} ${side}`, parentScopeId: options.parentScopeId });
  return id;
}

function collectBinaryParts(query: SelectQuery, operator: string): SelectQuery[] {
  if (query instanceof BinarySelectQuery && query.operator.value.toUpperCase() === operator) {
    return [...collectBinaryParts(query.left, operator), ...collectBinaryParts(query.right, operator)];
  }

  return [query];
}

function collectBinaryOutputColumns(query: BinarySelectQuery, leftId: string, rightId: string, nodes: Map<string, LineageNode>): LineageColumn[] {
  const leftColumns = nodes.get(leftId)?.columns ?? [];
  const rightColumns = nodes.get(rightId)?.columns ?? [];
  const names = collectBinaryOutputColumnNames(query, leftColumns, rightColumns);
  return names.map((name, index) => ({
    id: '',
    name,
    upstream: mergeColumnRefs(
      leftColumns[index] ? [{ nodeId: leftId, columnName: leftColumns[index].name }] : [],
      rightColumns[index] ? [{ nodeId: rightId, columnName: rightColumns[index].name }] : [],
    ),
  }));
}

function collectBinaryOutputColumnsFromParts(query: BinarySelectQuery, partIds: string[], nodes: Map<string, LineageNode>): LineageColumn[] {
  const partColumns = partIds.map((partId) => nodes.get(partId)?.columns ?? []);
  const names = collectQueryOutputColumnNames(query);
  const maxLength = Math.max(names.length, ...partColumns.map((columns) => columns.length));
  return Array.from({ length: maxLength }, (_, index) => {
    const upstream = partIds.flatMap((partId, partIndex) => {
      const column = partColumns[partIndex]?.[index];
      return column ? [{ nodeId: partId, columnName: column.name }] : [];
    });
    return {
      id: '',
      name: names[index] ?? partColumns.find((columns) => columns[index])?.[index]?.name ?? `column_${index + 1}`,
      upstream,
    };
  });
}

function collectBinaryOutputColumnNames(query: BinarySelectQuery, leftColumns: LineageColumn[], rightColumns: LineageColumn[]): string[] {
  const leftNames = collectQueryOutputColumnNames(query.left);
  const rightNames = collectQueryOutputColumnNames(query.right);
  const maxLength = Math.max(leftColumns.length, rightColumns.length, leftNames.length, rightNames.length);
  return Array.from({ length: maxLength }, (_, index) => leftNames[index] ?? rightNames[index] ?? leftColumns[index]?.name ?? rightColumns[index]?.name ?? `column_${index + 1}`);
}

function collectQueryOutputColumnNames(query: unknown): string[] {
  if (query instanceof SimpleSelectQuery) {
    return query.selectClause.items.map((item, index) => getSelectItemOutputName(item, index));
  }

  if (query instanceof BinarySelectQuery) {
    return collectQueryOutputColumnNames(query.left);
  }

  return [];
}

function collectCteExecutableSql(
  query: unknown,
  ctes: CommonTable[],
  warnings: AnalysisWarning[],
  cteCommentsByName: Map<string, string[] | undefined>,
): Map<string, string> {
  const sqlByName = new Map<string, string>();
  if (ctes.length === 0) {
    return sqlByName;
  }

  if (!(query instanceof SimpleSelectQuery)) {
    warnings.push({
      code: 'cte-executable-sql-unsupported-query-kind',
      message: 'Executable CTE SQL extraction is only available for simple SELECT queries in the MVP adapter.',
    });
    return sqlByName;
  }

  const decomposer = new CTEQueryDecomposer();
  const cteByName = new Map(ctes.map((cte) => [cte.getSourceAliasName(), cte]));
  for (const cte of ctes) {
    const cteName = cte.getSourceAliasName();
    try {
      const result = decomposer.extractCTE(query, cteName);
      sqlByName.set(cteName, formatCteExecutableSql(cteName, result.executableSql, result.dependencies, cteByName, cteCommentsByName));
      for (const warning of result.warnings) {
        warnings.push({
          code: 'cte-executable-sql-warning',
          message: `${cteName}: ${warning}`,
        });
      }
    } catch (error) {
      warnings.push({
        code: 'cte-executable-sql-failed',
        message: `Could not extract executable SQL for CTE ${cteName}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return sqlByName;
}

function formatCteExecutableSql(
  cteName: string,
  sql: string,
  dependencies: string[],
  cteByName: Map<string, CommonTable>,
  cteCommentsByName: Map<string, string[] | undefined>,
): string {
  const targetCte = cteByName.get(cteName);
  if (targetCte) {
    const formattedTargetSql = prependHeaderCommentsIfMissing(formatNodeQuerySql(targetCte.query), cteCommentsByName.get(cteName));
    if (formattedTargetSql) {
      const dependencySql = dependencies
        .map((dependencyName) => {
          const dependencyCte = cteByName.get(dependencyName);
          const formattedDependencySql = dependencyCte ? formatNodeQuerySql(dependencyCte.query) : undefined;
          return formattedDependencySql ? { name: dependencyName, sql: formattedDependencySql } : null;
        })
        .filter((dependency): dependency is { name: string; sql: string } => dependency !== null);

      if (dependencySql.length === 0) {
        return formattedTargetSql;
      }

      const withSql = dependencySql
        .map((dependency, index) => {
          const suffix = index === dependencySql.length - 1 ? '' : ',';
          const comments = cteCommentsByName.get(dependency.name)?.filter((comment) => !dependency.sql.includes(comment));
          const commentSql = comments?.length ? `${formatSmartCommentBlock(comments, '  ')}\n` : '';
          return `${commentSql}  ${dependency.name} as (\n${indentSql(dependency.sql)}\n  )${suffix}`;
        })
        .join('\n');
      return `with\n${withSql}\n${formattedTargetSql}`;
    }
  }

  const trimmedSql = sql.trim();
  try {
    return nodeSqlFormatter.format(SelectQueryParser.parse(trimmedSql)).formattedSql.trim();
  } catch {
    return trimmedSql;
  }
}

function formatNodeQuerySql(query: unknown): string | undefined {
  try {
    return nodeSqlFormatter.format(query as Parameters<SqlFormatter['format']>[0]).formattedSql.trim();
  } catch {
    return undefined;
  }
}

function formatNodeQuerySqlWithError(query: unknown): { failure?: string; sql?: string } {
  try {
    return { sql: nodeSqlFormatter.format(query as Parameters<SqlFormatter['format']>[0]).formattedSql.trim() };
  } catch (error) {
    return { failure: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatStandaloneQuerySql(query: unknown): string | undefined {
  return prependHeaderCommentsIfMissing(formatNodeQuerySql(query), extractQueryNodeComments(query));
}

function formatScopeQuerySql(query: SimpleSelectQuery): string | undefined {
  return formatStandaloneQuerySql(cloneSelectQueryWithoutCtes(query));
}

function cloneSelectQueryWithoutCtes(query: SimpleSelectQuery): SimpleSelectQuery {
  if (!query.withClause) {
    return query;
  }
  return Object.assign(Object.create(Object.getPrototypeOf(query)), query, {
    cteNameCache: new Set(),
    withClause: undefined,
  }) as SimpleSelectQuery;
}

function formatOutputQuerySql(query: unknown, cteCommentsByName: Map<string, string[] | undefined>): string | undefined {
  const formattedSql = formatNodeQuerySql(query);
  if (!formattedSql || cteCommentsByName.size === 0) {
    return formattedSql;
  }
  return restoreCteHeaderComments(formattedSql, cteCommentsByName);
}

function prependHeaderCommentsIfMissing(sql: string | undefined, comments: string[] | undefined): string | undefined {
  if (!sql || !comments?.length || comments.every((comment) => sql.includes(comment))) {
    return sql;
  }
  const missingComments = comments.filter((comment) => !sql.includes(comment));
  return `${formatSmartCommentBlock(missingComments, '')}\n${sql}`;
}

function restoreCteHeaderComments(sql: string, cteCommentsByName: Map<string, string[] | undefined>): string {
  let restoredSql = sql;
  for (const [cteName, comments] of cteCommentsByName) {
    if (!comments) {
      continue;
    }
    if (!comments.length || comments.every((comment) => restoredSql.includes(comment))) {
      continue;
    }
    const declarationPattern = new RegExp(`^(\\s*)(${escapeRegExp(cteName)}\\s+as\\s*\\()`, 'im');
    restoredSql = restoredSql.replace(declarationPattern, (_match, indent: string, declaration: string) => {
      const commentSql = formatSmartCommentBlock(comments, indent);
      return `${commentSql}\n${indent}${declaration}`;
    });
  }
  return restoredSql;
}

function formatSmartCommentBlock(comments: string[], indent: string): string {
  const lines = comments.flatMap((comment) => comment.split(/\r?\n/).map((line) => line.trimEnd()));
  if (lines.length === 1) {
    return `${indent}-- ${lines[0]}`;
  }
  return [
    `${indent}/*`,
    ...lines.map((line) => `${indent}  ${line}`),
    `${indent}*/`,
  ].join('\n');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function indentSql(sql: string): string {
  return sql
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

function resolveSourceExpression(
  source: SourceExpression,
  cteNames: Set<string>,
  nodes: Map<string, LineageNode>,
  edges: LineageEdge[],
  scopes: LineageScope[],
  warnings: AnalysisWarning[],
  derivedCounter: { value: number },
  scalarSubqueryCounter: { value: number },
  scopeCounter: { value: number },
  recursiveRootId?: string,
  schemaFacts?: SchemaFacts,
): ResolvedSource {
  const datasource = source.datasource;

  if (datasource instanceof TableSource) {
    const sourceName = datasource.getSourceName();
    const alias = source.aliasExpression ? source.getAliasName() : null;
    const aliases = alias ? [alias, sourceName] : getUnaliasedTableSourceAliases(datasource);
    if (cteNames.has(sourceName)) {
      const node = findCteSourceNode(sourceName, nodes);
      const cteId = toCteId(sourceName);
      const recursive = cteId === recursiveRootId;
      if (recursive) {
        node.recursive = true;
      }
      return {
        node,
        aliases,
        sourceAlias: alias ?? undefined,
        recursive,
      };
    }
    if (isDualTableName(sourceName)) {
      const node = createParameterTableNode(sourceName, nodes);
      return {
        node,
        aliases,
        sourceAlias: alias ?? 'dual',
      };
    }
    return {
      node: createTableNode(sourceName, nodes, schemaFacts),
      aliases,
      sourceAlias: alias ?? undefined,
    };
  }

  if (datasource instanceof SubQuerySource) {
    derivedCounter.value += 1;
    const alias = source.getAliasName() ?? `subquery_${derivedCounter.value}`;
    if (isParameterSelectQuery(datasource.query)) {
      const node = createParameterTableNode(alias, nodes);
      node.comments = extractQueryNodeComments(datasource.query);
      node.querySql = formatStandaloneQuerySql(datasource.query);
      collectQueryEdges({
        query: datasource.query,
        targetId: node.id,
        targetLabel: alias,
        cteNames,
        nodes,
        edges,
        scopes,
        warnings,
        derivedCounter,
        scalarSubqueryCounter,
        scopeCounter,
        recursiveRootId,
        parentScopeId: undefined,
        schemaFacts,
      });
      return {
        node,
        aliases: [alias],
        sourceAlias: alias,
      };
    }
    const id = `derived_${sanitizeId(alias)}_${derivedCounter.value}`;
    const node: LineageNode = {
      id,
      type: 'derived',
      label: alias,
      columns: [],
      comments: extractQueryNodeComments(datasource.query),
      querySql: formatStandaloneQuerySql(datasource.query),
    };
    nodes.set(id, node);
    collectQueryEdges({
      query: datasource.query,
      targetId: id,
      targetLabel: alias,
        cteNames,
        nodes,
        edges,
        scopes,
        warnings,
        derivedCounter,
        scalarSubqueryCounter,
        scopeCounter,
        recursiveRootId,
        parentScopeId: undefined,
        schemaFacts,
      });
    const wildcardPassthroughSource = resolveSinglePhysicalWildcardPassthroughSource(datasource.query, cteNames, nodes, schemaFacts);
    return {
      node,
      aliases: [alias],
      sourceAlias: alias,
      wildcardPassthroughSource,
    };
  }

  if (datasource instanceof ParenSource) {
    return resolveSourceExpression(
      {
        datasource: datasource.source,
        aliasExpression: source.aliasExpression,
      } as SourceExpression,
      cteNames,
      nodes,
      edges,
      scopes,
      warnings,
      derivedCounter,
      scalarSubqueryCounter,
      scopeCounter,
      recursiveRootId,
      schemaFacts,
    );
  }

  if (datasource instanceof FunctionSource) {
    const name = datasource.name instanceof Object && 'name' in datasource.name ? datasource.name.name : String(datasource.name);
    const alias = source.aliasExpression ? source.getAliasName() : null;
    return {
      node: createDerivedNode(`function_${sanitizeId(name)}`, name, nodes),
      aliases: [alias ?? name],
      sourceAlias: alias ?? undefined,
    };
  }

  warnings.push({
    code: 'unsupported-source-kind',
    message: `Unsupported source kind ${source.datasource.constructor.name}; created an unknown derived node.`,
  });
  return {
    node: createDerivedNode(`derived_unknown_${nodes.size}`, 'unknown source', nodes),
    aliases: [source.getAliasName() ?? 'unknown source'],
    sourceAlias: source.getAliasName() ?? undefined,
  };
}

function resolveSinglePhysicalWildcardPassthroughSource(
  query: unknown,
  cteNames: Set<string>,
  nodes: Map<string, LineageNode>,
  schemaFacts?: SchemaFacts,
): ResolvedSource['wildcardPassthroughSource'] | undefined {
  if (!(query instanceof SimpleSelectQuery) || !query.fromClause || (query.fromClause.joins ?? []).length > 0) {
    return undefined;
  }
  if (!hasWildcardSelectItem(query) || query.selectClause.items.some((item) => !(item.value instanceof ColumnReference && item.value.column.name === '*'))) {
    return undefined;
  }

  const source = query.fromClause.source;
  if (!(source.datasource instanceof TableSource)) {
    return undefined;
  }

  const sourceName = source.datasource.getSourceName();
  if (cteNames.has(sourceName) || isDualTableName(sourceName)) {
    return undefined;
  }

  const alias = source.aliasExpression ? source.getAliasName() : null;
  return {
    aliases: alias ? [alias, sourceName] : getUnaliasedTableSourceAliases(source.datasource),
    node: createTableNode(sourceName, nodes, schemaFacts),
    sourceAlias: alias ?? undefined,
  };
}

function nextScopeId(options: CollectQueryEdgesOptions, targetId: string): string {
  const baseId = `scope_${sanitizeId(targetId)}`;
  if (!options.scopes.some((scope) => scope.id === baseId)) {
    return baseId;
  }
  options.scopeCounter.value += 1;
  return `${baseId}_${options.scopeCounter.value}`;
}

function createPopulationOriginDeps(options: CollectQueryEdgesOptions): PopulationOriginDeps {
  return {
    collectNestedQueryReferences: (value) => collectNestedQueryReferences(value, options),
    formatExpressionSql,
    formatScopeQuerySql,
    getInlineQueryShadowedAliases: (inlineQuery) => collectInlineQueryLocalAliases(inlineQuery),
  };
}

function collectInlineQueryLocalAliases(inlineQuery: InlineQuery): ReadonlySet<string> {
  const query = inlineQuery.selectQuery;
  if (!(query instanceof SimpleSelectQuery)) {
    return new Set();
  }
  return new Set(
    (query.fromClause?.getSources() ?? [])
      .map((source) => {
        if (source.aliasExpression) {
          const alias = source.getAliasName();
          return alias ? [alias] : [];
        }
        return source.datasource instanceof TableSource
          ? getUnaliasedTableSourceAliases(source.datasource)
          : [];
      })
      .flat()
      .filter((namespace): namespace is string => Boolean(namespace)),
  );
}

function getUnaliasedTableSourceAliases(source: TableSource): string[] {
  return [...new Set([source.getSourceName(), source.table.name])];
}

function createOutputColumnDeps(options: CollectQueryEdgesOptions): OutputColumnDeps {
  return {
    addWarning: (warning) => options.warnings.push(warning),
    collectExpressionBreakdownRules,
    collectExpressionTree,
    collectNestedExpressionLineage: (value) => collectNestedExpressionLineage(value, options),
    collectScalarSubqueryLineage: (value, ownerOutputColumnName, outerSources, parentScopeId) =>
      collectScalarSubqueryLineage(value, ownerOutputColumnName, outerSources, options, parentScopeId),
    extractSelectItemComments,
    formatExpressionSql,
    recordUnresolvedColumnWarnings: (unresolved, scopeId, outputColumnName) =>
      recordUnresolvedColumnWarnings(options.warnings, unresolved, scopeId, outputColumnName),
    schemaFacts: options.schemaFacts,
    setNodeColumns: (nodeId, columns) => setNodeColumns(options.nodes, nodeId, columns),
  };
}

function collectNestedQueryReferences(value: unknown, options: CollectQueryEdgesOptions): LineageColumnRef[] {
  const refs: LineageColumnRef[] = [];
  for (const query of collectNestedSimpleSelectQueries(value)) {
    refs.push(...collectQueryLocalReferences(query, options));
  }
  return refs;
}

function collectQueryLocalReferences(query: SimpleSelectQuery, options: CollectQueryEdgesOptions): LineageColumnRef[] {
  const fromClause = query.fromClause;
  if (!fromClause) {
    return [];
  }
  const localEdges: LineageEdge[] = [];
  const sources = [
    resolveSourceExpression(
      fromClause.source,
      options.cteNames,
      options.nodes,
      localEdges,
      options.scopes,
      options.warnings,
      options.derivedCounter,
      options.scalarSubqueryCounter,
      options.scopeCounter,
      options.recursiveRootId,
      options.schemaFacts,
    ),
  ];
  for (const join of fromClause.joins ?? []) {
    sources.push(resolveSourceExpression(
      join.source,
      options.cteNames,
      options.nodes,
      localEdges,
      options.scopes,
      options.warnings,
      options.derivedCounter,
      options.scalarSubqueryCounter,
      options.scopeCounter,
      options.recursiveRootId,
      options.schemaFacts,
    ));
  }
  return resolveColumnReferences(query, toSourceReferenceTargets(sources));
}

// output-columns slice boundary:
// Returns SELECT-derived display columns only. Population-origin references are
// collected by collectPopulationScope and must not be appended here.
function collectOutputColumns(query: SimpleSelectQuery, sources: ResolvedSource[], deps: OutputColumnDeps, scopeId: string): LineageColumn[] {
  if (hasWildcardSelectItem(query)) {
    if (deps.schemaFacts) {
      const rawsqlColumns = collectRawsqlExpandedSelectColumns(query, sources, deps, scopeId);
      if (rawsqlColumns.length > 0) {
        return rawsqlColumns;
      }
    }

    const sourceExpandedColumns = collectSourceExpandedSelectColumns(query, sources, deps, scopeId);
    if (sourceExpandedColumns.unresolvedWildcardCount === 0) {
      return sourceExpandedColumns.columns;
    }

    const rawsqlColumns = deps.schemaFacts
      ? []
      : collectRawsqlExpandedSelectColumns(query, sources, deps, scopeId);
    return [
      ...(rawsqlColumns.length > 0 ? rawsqlColumns : sourceExpandedColumns.columns),
    ];
  }

  const selectedColumns: LineageColumn[] = query.selectClause.items.map((item, index) =>
    collectSelectItemOutputColumn(query, item, index, index, sources, deps, scopeId),
  );
  backfillWildcardPassthroughColumns(selectedColumns, sources, deps);
  return selectedColumns;
}

function backfillWildcardPassthroughColumns(columns: LineageColumn[], sources: ResolvedSource[], deps: OutputColumnDeps): void {
  const sourceByNodeId = new Map(sources.map((source) => [source.node.id, source]));
  for (const column of columns) {
    for (const upstream of column.upstream ?? []) {
      const source = sourceByNodeId.get(upstream.nodeId);
      if (!source?.wildcardPassthroughSource) {
        continue;
      }
      const sourceColumn: LineageColumn = {
        id: '',
        name: upstream.columnName,
        expressionSql: formatWildcardColumnExpressionSql(source.wildcardPassthroughSource, upstream.columnName),
        upstream: [{
          nodeId: source.wildcardPassthroughSource.node.id,
          columnName: upstream.columnName,
        }],
      };
      deps.setNodeColumns(source.node.id, [sourceColumn]);
      deps.setNodeColumns(source.wildcardPassthroughSource.node.id, [upstream.columnName]);
    }
  }
}

function collectSelectItemOutputColumn(
  query: SimpleSelectQuery,
  item: SimpleSelectQuery['selectClause']['items'][number],
  itemIndex: number,
  outputIndex: number,
  sources: ResolvedSource[],
  deps: OutputColumnDeps,
  scopeId: string,
): LineageColumn {
  const comments = deps.extractSelectItemComments(query.selectClause.items, itemIndex);
  const caseRules = deps.collectExpressionBreakdownRules(item.value, sources);
  const expressionTree = deps.collectExpressionTree(item.value, sources);
  const name = getSelectItemOutputName(item, outputIndex);
  const scalarSubqueryRefs = deps.collectScalarSubqueryLineage(item.value, name, sources, scopeId);
  const resolvedReferences = resolveColumnReferencesWithIssues(item.value, toSourceReferenceTargets(sources), { formatExpressionSql: deps.formatExpressionSql, skipInlineQueries: true });
  const unresolvedUpstream = resolvedReferences.unresolved;
  deps.recordUnresolvedColumnWarnings(unresolvedUpstream, scopeId, name);
  const nestedExpressionRefs = scalarSubqueryRefs.length > 0 ? [] : deps.collectNestedExpressionLineage(item.value);
  const upstream = mergeColumnRefs(
    mergeColumnRefs(scalarSubqueryRefs, resolvedReferences.resolved),
    nestedExpressionRefs,
  );
  return {
    id: '',
    name,
    comments,
    caseRules,
    expressionTree,
    expressionSql: deps.formatExpressionSql(item.value),
    outputIndex,
    selectItemId: createSelectItemId(scopeId, outputIndex),
    scopeId,
    upstream,
    unresolvedUpstream: unresolvedUpstream.length > 0 ? unresolvedUpstream : undefined,
    usage: isGroupedSelectItem(item.value, query) ? { role: 'condition', reasons: ['groupBy'] } : undefined,
  };
}

function collectSourceExpandedSelectColumns(
  query: SimpleSelectQuery,
  sources: ResolvedSource[],
  deps: OutputColumnDeps,
  scopeId: string,
): { columns: LineageColumn[]; unresolvedWildcardCount: number } {
  const columns: LineageColumn[] = [];
  let outputIndex = 0;
  let unresolvedWildcardCount = 0;

  query.selectClause.items.forEach((item, itemIndex) => {
    if (item.value instanceof ColumnReference && item.value.column.name === '*') {
      const wildcardColumns = expandWildcardFromResolvedSources(item.value, sources, scopeId, outputIndex);
      if (wildcardColumns.length === 0) {
        unresolvedWildcardCount += 1;
        return;
      }
      columns.push(...wildcardColumns);
      outputIndex += wildcardColumns.length;
      return;
    }

    columns.push(collectSelectItemOutputColumn(query, item, itemIndex, outputIndex, sources, deps, scopeId));
    outputIndex += 1;
  });

  return { columns, unresolvedWildcardCount };
}

function expandWildcardFromResolvedSources(
  reference: ColumnReference,
  sources: ResolvedSource[],
  scopeId: string,
  startOutputIndex: number,
): LineageColumn[] {
  const qualifier = getWildcardQualifier(reference);
  const matchingSources = qualifier
    ? sources.filter((source) => source.aliases.some((alias) => sameIdentifier(alias, qualifier)))
    : sources;
  let offset = 0;

  return matchingSources.flatMap((source) =>
    source.node.columns
      .filter((column) => !column.usage || column.outputIndex !== undefined)
      .map((column) => {
        const outputIndex = startOutputIndex + offset;
        offset += 1;
        return {
          id: '',
          name: column.name,
          outputIndex,
          selectItemId: createSelectItemId(scopeId, outputIndex),
          scopeId,
          expressionSql: formatWildcardColumnExpressionSql(source, column.name),
          upstream: [{
            nodeId: source.node.id,
            columnName: column.name,
          }],
        };
      }),
  );
}

function formatWildcardColumnExpressionSql(source: ResolvedSource, columnName: string): string {
  const qualifier = source.sourceAlias ?? source.aliases[0];
  return qualifier ? `${qualifier}.${columnName}` : columnName;
}

function collectScalarSubqueryLineage(
  value: unknown,
  ownerOutputColumnName: string,
  outerSources: ResolvedSource[],
  options: CollectQueryEdgesOptions,
  parentScopeId: string,
): LineageColumnRef[] {
  const inlineQueries = collectInlineQueries(value);
  if (inlineQueries.length === 0) {
    return [];
  }
  const isWholeColumnExpression = value instanceof InlineQuery && inlineQueries.length === 1;

  return inlineQueries.flatMap((inlineQuery, index) => {
    const query = inlineQuery.selectQuery;
    if (!isSelectQuery(query)) {
      return [];
    }

    options.scalarSubqueryCounter.value += 1;
    const id = `scalar_subquery_${sanitizeId(ownerOutputColumnName)}_${options.scalarSubqueryCounter.value}`;
    const ownerExpressionRole = isWholeColumnExpression ? 'whole_column' : 'expression_part';
    const ownerExpressionPartIndex = ownerExpressionRole === 'expression_part' ? index + 1 : undefined;
    const label = ownerExpressionRole === 'whole_column'
      ? ownerOutputColumnName
      : `${ownerOutputColumnName}_${ownerExpressionPartIndex}`;
    const outputExpressionSql = getScalarSubqueryOutputExpressionSql(query);
    const correlatedRefs = query instanceof SimpleSelectQuery ? collectCorrelationReferences(query, outerSources, options) : [];

    options.nodes.set(id, {
      id,
      type: 'scalar_subquery',
      label,
      columns: [],
      querySql: formatStandaloneQuerySql(query),
      scalarSubquery: {
        correlated: correlatedRefs.length > 0,
        outputExpressionSql,
        ownerOutputColumnName,
        ownerOutputNodeId: options.targetId,
        ownerExpressionRole,
        ownerExpressionPartIndex,
        parentScopeId,
        sql: formatExpressionSql(inlineQuery),
      },
    });

    collectQueryEdges({
      ...options,
      query,
      targetId: id,
      targetLabel: label,
      parentScopeId,
    });

    addLineageEdge(options.edges, {
      source: id,
      target: options.targetId,
      type: 'dataFlow',
      kind: 'subquery_value',
      confidence: 'high',
    });

    const scalarNode = options.nodes.get(id);
    const scalarScopeId = scalarNode?.dependencyProfile?.scopeIds?.[0] ?? options.scopes.find((scope) => scope.nodeId === id)?.id;
    if (scalarNode?.scalarSubquery && scalarScopeId) {
      scalarNode.scalarSubquery.scopeId = scalarScopeId;
      if (query instanceof SimpleSelectQuery) {
        scalarNode.scalarSubquery.correlationConditions = collectCorrelationConditions(query, outerSources, options, scalarScopeId);
      }
    }

    for (const ref of correlatedRefs) {
      addLineageEdge(options.edges, {
        source: ref.nodeId,
        target: id,
        type: 'dataFlow',
        kind: 'correlation',
        sourceAlias: findSourceAlias(ref.nodeId, outerSources),
        confidence: 'medium',
      });
      setNodeColumns(options.nodes, ref.nodeId, [ref.columnName]);
    }

    const outputColumnName = scalarNode?.columns[0]?.name ?? ownerOutputColumnName;
    return [{ nodeId: id, columnName: outputColumnName, scopeId: scalarScopeId }];
  });
}

// value-origin boundary:
// Scalar subquery value lineage still owns adapter state changes: nodes, edges,
// counters, correlation metadata, and upstream node column backfill.
// Do not move this with output-columns until that state has a narrower API.
function collectInlineQueries(value: unknown): InlineQuery[] {
  const queries: InlineQuery[] = [];
  const visited = new Set<unknown>();

  const visit = (current: unknown): void => {
    if (!current || typeof current !== 'object' || visited.has(current)) {
      return;
    }
    visited.add(current);

    if (current instanceof InlineQuery) {
      queries.push(current);
      return;
    }

    for (const nested of Object.values(current)) {
      if (Array.isArray(nested)) {
        nested.forEach(visit);
      } else {
        visit(nested);
      }
    }
  };

  visit(value);
  return queries;
}

function getScalarSubqueryOutputExpressionSql(query: SelectQuery): string | undefined {
  if (!(query instanceof SimpleSelectQuery)) {
    return formatExpressionSql(query);
  }
  const value = query.selectClause.items[0]?.value;
  return value ? formatExpressionSql(value) : undefined;
}

function collectCorrelationReferences(
  query: SimpleSelectQuery,
  outerSources: ResolvedSource[],
  options: CollectQueryEdgesOptions,
): LineageColumnRef[] {
  const innerSources = collectQuerySourcesForReferenceResolution(query, options);
  if (innerSources.length === 0) {
    return [];
  }

  const localRefs = resolveColumnReferences(query, toSourceReferenceTargets(innerSources));
  const localKeys = new Set(localRefs.map((ref) => `${ref.nodeId}.${ref.columnName}`));
  return resolveColumnReferences(query, toSourceReferenceTargets(outerSources))
    .filter((ref) => !localKeys.has(`${ref.nodeId}.${ref.columnName}`));
}

function collectCorrelationConditions(
  query: SimpleSelectQuery,
  outerSources: ResolvedSource[],
  options: CollectQueryEdgesOptions,
  scopeId: string,
): NonNullable<NonNullable<LineageNode['scalarSubquery']>['correlationConditions']> {
  const innerSources = collectQuerySourcesForReferenceResolution(query, options);
  if (innerSources.length === 0) {
    return [];
  }

  return splitAndConditions(query.whereClause?.condition).flatMap((condition) => {
    const outerRefs = resolveColumnReferences(condition, toSourceReferenceTargets(outerSources));
    if (outerRefs.length === 0) {
      return [];
    }
    const innerRefs = resolveColumnReferences(condition, toSourceReferenceTargets(innerSources));
    return [{
      expressionSql: formatExpressionSql(condition) ?? 'unknown correlation condition',
      references: toSourceReferences(mergeColumnRefs(innerRefs, outerRefs), scopeId, 'row_lineage'),
      scopeId,
    }];
  });
}

function toSourceReferences(
  refs: LineageColumnRef[],
  scopeId: string,
  role: LineageSourceReference['role'],
): LineageSourceReference[] {
  return refs.map((ref) => ({
    columnName: ref.columnName,
    nodeId: ref.nodeId,
    role,
    scopeId,
  }));
}

function collectQuerySourcesForReferenceResolution(
  query: SimpleSelectQuery,
  options: CollectQueryEdgesOptions,
): ResolvedSource[] {
  const fromClause = query.fromClause;
  if (!fromClause) {
    return [];
  }

  const localEdges: LineageEdge[] = [];
  const innerSources = [
    resolveSourceExpression(
      fromClause.source,
      options.cteNames,
      options.nodes,
      localEdges,
      options.scopes,
      options.warnings,
      options.derivedCounter,
      options.scalarSubqueryCounter,
      options.scopeCounter,
      options.recursiveRootId,
      options.schemaFacts,
    ),
  ];
  for (const join of fromClause.joins ?? []) {
    innerSources.push(resolveSourceExpression(
      join.source,
      options.cteNames,
      options.nodes,
      localEdges,
      options.scopes,
      options.warnings,
      options.derivedCounter,
      options.scalarSubqueryCounter,
      options.scopeCounter,
      options.recursiveRootId,
      options.schemaFacts,
    ));
  }
  return innerSources;
}

function findSourceAlias(nodeId: string, sources: ResolvedSource[]): string | undefined {
  return sources.find((source) => source.node.id === nodeId)?.sourceAlias;
}

function hasWildcardSelectItem(query: SimpleSelectQuery): boolean {
  return query.selectClause.items.some((item) =>
    item.value instanceof ColumnReference && item.value.column.name === '*',
  );
}

function collectRawsqlExpandedSelectColumns(
  query: SimpleSelectQuery,
  sources: ResolvedSource[],
  deps: OutputColumnDeps,
  scopeId: string,
): LineageColumn[] {
  const sourceTargets = toSourceReferenceTargets(sources);
  const rawsqlColumns = new SelectOutputCollector(
    deps.schemaFacts ? createTableColumnResolver(deps.schemaFacts) : null,
  ).collect(query);

  if (rawsqlColumns.length === 0) {
    deps.addWarning({
      code: 'wildcard_unresolved_without_schema',
      message: 'Wildcard columns could not be expanded because schema facts were not provided or the source columns are unknown.',
    });
    return [];
  }

  return rawsqlColumns.map((column) => {
    const upstream = mergeColumnRefs(resolveColumnReferences(column.value, sourceTargets), deps.collectNestedExpressionLineage(column.value));
    const matchingItem = findSelectItemForRawsqlValue(query, column.value);
    const comments = matchingItem ? deps.extractSelectItemComments(query.selectClause.items, query.selectClause.items.indexOf(matchingItem)) : undefined;
    return {
      id: '',
      name: column.name,
      comments,
      caseRules: deps.collectExpressionBreakdownRules(column.value, sources),
      expressionTree: deps.collectExpressionTree(column.value, sources),
      expressionSql: deps.formatExpressionSql(column.value),
      outputIndex: column.outputIndex,
      selectItemId: createSelectItemId(scopeId, column.outputIndex),
      scopeId,
      upstream,
      usage: matchingItem && isGroupedSelectItem(matchingItem.value, query) ? { role: 'condition', reasons: ['groupBy'] } : undefined,
    };
  });
}

function createSelectItemId(scopeId: string, outputIndex: number): string {
  return `${scopeId}_output_${outputIndex + 1}`;
}

function getWildcardQualifier(reference: ColumnReference): string | undefined {
  const namespaces = reference.qualifiedName.namespaces;
  if (!namespaces || namespaces.length === 0) {
    return undefined;
  }
  return namespaces.map((namespace) => namespace.name).join('.');
}

function sameIdentifier(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function findSelectItemForRawsqlValue(
  query: SimpleSelectQuery,
  value: unknown,
): SimpleSelectQuery['selectClause']['items'][number] | undefined {
  const valueSql = formatExpressionSql(value);
  return query.selectClause.items.find((item) =>
    !(item.value instanceof ColumnReference && item.value.column.name === '*')
    && formatExpressionSql(item.value) === valueSql,
  );
}

function splitAndConditions(condition: unknown): unknown[] {
  if (isBinaryExpressionLike(condition) && condition.operator.value.toLowerCase() === 'and') {
    return [...splitAndConditions(condition.left), ...splitAndConditions(condition.right)];
  }
  return [condition];
}

// SQL analysis is owned by rawsql-ts. Wildcard select items are expanded through
// SelectOutputCollector above; the lineage adapter only enriches those results
// with scopeId, nodeId/upstream mapping, usage metadata, and diagnostics.

function getSelectItemOutputName(item: SimpleSelectQuery['selectClause']['items'][number], index: number): string {
  if (item.identifier) {
    return item.identifier.name;
  }
  if (item.value instanceof ColumnReference) {
    return item.value.column.name;
  }
  return `expr_${index + 1}`;
}

// value-origin boundary:
// CASE rules and expression trees describe how output values are produced.
// They are consumed by output column creation today, but they are not display
// column selection rules.
function collectExpressionBreakdownRules(value: unknown, sources: ResolvedSource[]): LineageCaseRule[] | undefined {
  return collectCaseRules(value, sources);
}

function collectCaseRules(value: unknown, sources: ResolvedSource[]): LineageCaseRule[] | undefined {
  const cases = collectCaseExpressions(value);
  if (cases.length === 0) {
    return undefined;
  }

  const directSingleCase = cases.length === 1 && cases[0] === value;
  const collectedRules = cases.flatMap((caseExpression, caseIndex) => collectCaseExpressionRules(caseExpression, caseIndex, undefined, sources));
  const rules = directSingleCase
    ? collectedRules
    : collectedRules.map((rule, index) => ({
        ...rule,
        caseLabel: `case ${index + 1}`,
      }));
  return rules.length > 0 ? rules : undefined;
}

function collectExpressionTree(value: unknown, sources: ResolvedSource[]): LineageExpressionTree | undefined {
  const upstream = resolveColumnReferences(value, toSourceReferenceTargets(sources));
  if (upstream.length < 2) {
    return undefined;
  }

  const expressionSql = formatExpressionSql(value);
  if (!expressionSql || isSimpleColumnReference(expressionSql)) {
    return undefined;
  }

  return collectExpressionTreeNode(value, sources);
}

function collectExpressionTreeNode(value: unknown, sources: ResolvedSource[]): LineageExpressionTree | undefined {
  if (value instanceof ColumnReference) {
    const refs = resolveColumnReferences(value, toSourceReferenceTargets(sources));
    const sql = formatExpressionSql(value);
    if (refs.length !== 1 || !sql) {
      return undefined;
    }
    return { kind: 'column', ref: refs[0], sql };
  }

  if (isBinaryExpressionLike(value)) {
    const sql = formatExpressionSql(value);
    const operator = value.operator.value;
    const left = collectExpressionTreeNode(value.left, sources);
    const right = collectExpressionTreeNode(value.right, sources);
    const upstream = resolveColumnReferences(value, toSourceReferenceTargets(sources));
    if (!sql || !operator || !left || !right || upstream.length < 2) {
      return undefined;
    }

    return {
      children: [left, right],
      kind: 'operator',
      operator,
      sql,
      upstream,
    };
  }

  return undefined;
}

function isBinaryExpressionLike(value: unknown): value is { left: unknown; operator: { value: string }; right: unknown } {
  return (
    value != null &&
    typeof value === 'object' &&
    'left' in value &&
    'right' in value &&
    'operator' in value &&
    typeof (value as { operator?: { value?: unknown } }).operator?.value === 'string'
  );
}

function collectCaseExpressions(value: unknown): unknown[] {
  const cases: unknown[] = [];
  const visited = new Set<unknown>();

  const visit = (current: unknown): void => {
    if (!current || typeof current !== 'object' || visited.has(current)) {
      return;
    }
    visited.add(current);

    if (isCaseExpressionLike(current)) {
      cases.push(current);
    }

    for (const nested of Object.values(current)) {
      if (Array.isArray(nested)) {
        nested.forEach(visit);
      } else {
        visit(nested);
      }
    }
  };

  visit(value);
  return cases;
}

function collectCaseExpressionRules(caseExpression: unknown, caseIndex: number, caseLabel: string | undefined, sources: ResolvedSource[]): LineageCaseRule[] {
  if (!isCaseExpressionLike(caseExpression)) {
    return [];
  }

  const sourceTargets = toSourceReferenceTargets(sources);
  const condition = caseExpression.condition;
  const switchCase = caseExpression.switchCase;
  const branches = Array.isArray(switchCase?.cases) ? switchCase.cases : [];
  const conditionRefs = condition ? resolveColumnReferences(condition, sourceTargets) : [];
  const rules: LineageCaseRule[] = [];

  branches.forEach((branch, branchIndex) => {
    if (!branch || typeof branch !== 'object') {
      return;
    }

    const key = (branch as { key?: unknown }).key;
    const result = (branch as { value?: unknown }).value;
    const conditionSql = formatCaseConditionSql(condition, key);
    const resultSql = formatExpressionSql(result);
    rules.push({
      id: `case_${caseIndex + 1}_when_${branchIndex + 1}`,
      label: conditionSql ? `when ${conditionSql}` : `when ${branchIndex + 1}`,
      caseLabel,
      conditionSql,
      expressionSql: formatCaseRuleDisplaySql(conditionSql, resultSql),
      resultSql,
      conditionUpstream: mergeColumnRefs(conditionRefs, resolveColumnReferences(key, sourceTargets)),
      resultUpstream: resolveColumnReferences(result, sourceTargets),
    });
  });

  if (switchCase && 'elseValue' in switchCase && switchCase.elseValue) {
    rules.push({
      id: `case_${caseIndex + 1}_else`,
      label: 'else',
      caseLabel,
      expressionSql: formatCaseRuleDisplaySql(undefined, formatExpressionSql(switchCase.elseValue)),
      resultSql: formatExpressionSql(switchCase.elseValue),
      conditionUpstream: [],
      resultUpstream: resolveColumnReferences(switchCase.elseValue, sourceTargets),
    });
  }

  return rules;
}

function isCaseExpressionLike(value: unknown): value is { condition?: unknown; switchCase?: { cases?: unknown[]; elseValue?: unknown } } {
  if (!value || typeof value !== 'object' || !('switchCase' in value)) {
    return false;
  }

  const switchCase = (value as { switchCase?: unknown }).switchCase;
  return Boolean(switchCase && typeof switchCase === 'object' && Array.isArray((switchCase as { cases?: unknown }).cases));
}

function formatCaseRuleDisplaySql(conditionSql: string | undefined, resultSql: string | undefined): string {
  if (conditionSql) {
    return resultSql ? `${conditionSql} then ${resultSql}` : conditionSql;
  }

  return resultSql ? `else ${resultSql}` : 'else';
}

function formatCaseConditionSql(condition: unknown, key: unknown): string | undefined {
  const keySql = formatExpressionSql(key);
  if (!condition) {
    return keySql;
  }

  const conditionSql = formatExpressionSql(condition);
  if (!conditionSql || !keySql) {
    return conditionSql ?? keySql;
  }
  return `${conditionSql} = ${keySql}`;
}

function isGroupedSelectItem(value: unknown, query: SimpleSelectQuery): boolean {
  const groupingRefs = collectColumnReferences(query.groupByClause?.grouping ?? []);
  if (groupingRefs.length === 0) {
    return false;
  }
  const valueRefs = collectColumnReferences(value);
  return valueRefs.some((valueRef) =>
    groupingRefs.some((groupRef) => valueRef.column.name === groupRef.column.name && valueRef.getNamespace() === groupRef.getNamespace()),
  );
}

function setReferencedSourceColumns(
  query: SimpleSelectQuery,
  sources: ResolvedSource[],
  warnings: AnalysisWarning[],
  scopeId: string,
): void {
  const sourceTargets = toSourceReferenceTargets(sources);
  const references = collectQueryConditionReferences(query);
  for (const { reason, refs } of references) {
    const resolvedReferences = resolveColumnReferencesWithIssues(refs, sourceTargets, { formatExpressionSql });
    recordUnresolvedColumnWarnings(warnings, resolvedReferences.unresolved, scopeId, `${reason} condition`);
  }
}

function collectNestedConditionLineage(query: SimpleSelectQuery, options: CollectQueryEdgesOptions): void {
  const conditionExpressions: Array<{ reason: LineageColumnUsageReason; value: unknown }> = [
    { reason: 'join', value: (query.fromClause?.joins ?? []).map((join) => join.condition) },
    { reason: 'where', value: query.whereClause?.condition },
    { reason: 'having', value: query.havingClause?.condition },
    { reason: 'orderBy', value: query.orderByClause?.order ?? [] },
  ];

  for (const { reason, value } of conditionExpressions) {
    for (const nestedQuery of collectNestedSimpleSelectQueries(value)) {
      collectNestedQueryLineage(nestedQuery, options, reason);
    }
  }
}

function setValueSourceColumns(columns: LineageColumn[], nodes: Map<string, LineageNode>): void {
  for (const column of columns) {
    if (column.usage?.role === 'filter') {
      continue;
    }
    for (const upstream of column.upstream ?? []) {
      setNodeColumns(nodes, upstream.nodeId, [upstream.columnName]);
    }
  }
}

function recordUnresolvedColumnWarnings(
  warnings: AnalysisWarning[],
  unresolved: LineageUnresolvedColumnReference[],
  scopeId: string,
  outputColumnName: string,
): void {
  for (const item of unresolved) {
    const code = `deadlink_${item.reason}`;
    const message = `Column "${outputColumnName}" has unresolved upstream reference "${item.sql}". ${item.suggestion}`;
    if (!warnings.some((warning) => warning.code === code && warning.message === message && warning.scopeId === scopeId)) {
      warnings.push({
        code,
        message,
        scopeId,
      });
    }
  }
}

function collectQueryConditionReferences(query: SimpleSelectQuery): Array<{ reason: LineageColumnUsageReason; refs: ColumnReference[] }> {
  const outputColumnNames = new Set(query.selectClause.items.map((item, index) => getSelectItemOutputName(item, index)));
  const orderByRefs = collectColumnReferences(query.orderByClause?.order ?? [])
    .filter((reference) => reference.getNamespace() || !outputColumnNames.has(reference.column.name));
  const references: Array<{ reason: LineageColumnUsageReason; refs: ColumnReference[] }> = [
    { reason: 'join', refs: collectColumnReferences((query.fromClause?.joins ?? []).map((join) => join.condition)) },
    { reason: 'where', refs: collectColumnReferences(query.whereClause?.condition) },
    { reason: 'groupBy', refs: collectColumnReferences(query.groupByClause?.grouping ?? []) },
    { reason: 'having', refs: collectColumnReferences(query.havingClause?.condition) },
    { reason: 'orderBy', refs: orderByRefs },
  ];
  return references.filter((item) => item.refs.length > 0);
}

function collectNestedExpressionLineage(
  value: unknown,
  options: CollectQueryEdgesOptions,
  usageReason: LineageColumnUsageReason = 'subquery',
): LineageColumnRef[] {
  const refs: LineageColumnRef[] = [];
  for (const query of collectNestedSimpleSelectQueries(value)) {
    refs.push(...collectNestedQueryLineage(query, options, usageReason));
  }
  return refs;
}

function collectNestedQueryLineage(
  query: SimpleSelectQuery,
  options: CollectQueryEdgesOptions,
  usageReason: LineageColumnUsageReason = 'subquery',
): LineageColumnRef[] {
  const { cteNames, nodes, edges, warnings, derivedCounter, targetId, recursiveRootId } = options;
  const fromClause = query.fromClause;
  if (!fromClause) {
    return [];
  }
  const nestedEdgeKind = getNestedQueryEdgeKind(usageReason);

  const sources = [resolveSourceExpression(fromClause.source, cteNames, nodes, edges, options.scopes, warnings, derivedCounter, options.scalarSubqueryCounter, options.scopeCounter, recursiveRootId, options.schemaFacts)];
  addLineageEdge(edges, {
    source: sources[0].node.id,
    target: targetId,
    type: 'dataFlow',
    kind: nestedEdgeKind,
    sourceAlias: sources[0].sourceAlias,
    recursive: sources[0].recursive ? { reason: 'cteSelfReference' } : undefined,
    confidence: 'medium',
  });

  for (const join of fromClause.joins ?? []) {
    const joinedSource = resolveSourceExpression(join.source, cteNames, nodes, edges, options.scopes, warnings, derivedCounter, options.scalarSubqueryCounter, options.scopeCounter, recursiveRootId, options.schemaFacts);
    sources.push(joinedSource);
    addLineageEdge(edges, {
      source: joinedSource.node.id,
      target: targetId,
      type: 'dataFlow',
      kind: nestedEdgeKind,
      sourceAlias: joinedSource.sourceAlias,
      joinNullability: toJoinNullability(normalizeJoinType(join)),
      recursive: joinedSource.recursive ? { reason: 'cteSelfReference' } : undefined,
      confidence: 'medium',
    });
  }

  setReferencedSourceColumns(query, sources, warnings, `scope_${sanitizeId(targetId)}_nested`);
  const sourceTargets = toSourceReferenceTargets(sources);
  const selectedRefs = resolveColumnReferences(collectColumnReferences(query.selectClause.items.map((item) => item.value)), sourceTargets);
  for (const source of sources) {
    for (const reference of selectedRefs) {
      if (reference.nodeId === source.node.id) {
        setNodeColumns(nodes, reference.nodeId, [reference.columnName]);
      }
    }
  }

  const nestedRefs = query.selectClause.items.flatMap((item) => collectNestedExpressionLineage(item.value, options));
  for (const ref of selectedRefs) {
    setNodeColumns(nodes, ref.nodeId, [
      usageReason === 'subquery'
        ? {
            id: '',
            name: ref.columnName,
            usage: { role: 'condition', reasons: [usageReason] },
          }
        : ref.columnName,
    ]);
  }

  return mergeColumnRefs(resolveColumnReferences(collectColumnReferences(query), sourceTargets), nestedRefs);
}

function getNestedQueryEdgeKind(usageReason: LineageColumnUsageReason): LineageEdge['kind'] {
  if (usageReason === 'join' || usageReason === 'where' || usageReason === 'having') {
    return 'predicate_subquery';
  }
  return undefined;
}

function collectNestedSimpleSelectQueries(value: unknown): SimpleSelectQuery[] {
  const queries: SimpleSelectQuery[] = [];
  const visited = new Set<unknown>();

  const visit = (current: unknown): void => {
    if (!current || typeof current !== 'object' || visited.has(current)) {
      return;
    }
    visited.add(current);

    if (current instanceof SimpleSelectQuery) {
      queries.push(current);
      return;
    }

    for (const nested of Object.values(current)) {
      if (Array.isArray(nested)) {
        nested.forEach(visit);
      } else {
        visit(nested);
      }
    }
  };

  visit(value);
  return queries;
}

function setNodeColumns(nodes: Map<string, LineageNode>, nodeId: string, columns: Array<string | LineageColumn>): void {
  const node = nodes.get(nodeId);
  if (!node) {
    return;
  }
  const duplicateOutputNames = collectDuplicateOutputColumnNames(columns);
  const seen = new Set(node.columns.map((column) => columnStorageKey(column, duplicateOutputNames)));
  const nextColumns = [...node.columns];
  for (const column of columns) {
    const name = typeof column === 'string' ? column : column.name;
    const comments = typeof column === 'string' ? undefined : column.comments;
    const caseRules = typeof column === 'string' ? undefined : column.caseRules;
    const expressionTree = typeof column === 'string' ? undefined : column.expressionTree;
    const expressionSql = typeof column === 'string' ? undefined : column.expressionSql;
    const outputIndex = typeof column === 'string' ? undefined : column.outputIndex;
    const selectItemId = typeof column === 'string' ? undefined : column.selectItemId;
    const scopeId = typeof column === 'string' ? undefined : column.scopeId;
    const upstream = typeof column === 'string' ? undefined : column.upstream;
    const unresolvedUpstream = typeof column === 'string' ? undefined : column.unresolvedUpstream;
    const usage = typeof column === 'string' ? undefined : column.usage;
    const key = columnStorageKey({ name, outputIndex }, duplicateOutputNames);
    if (!seen.has(key)) {
      seen.add(key);
      nextColumns.push({
        id: createColumnId(nodeId, name, outputIndex),
        name,
        comments,
        caseRules,
        expressionTree,
        expressionSql,
        outputIndex,
        selectItemId,
        scopeId,
        upstream,
        unresolvedUpstream,
        usage,
      });
    } else {
      const existing = nextColumns.find((item) => columnStorageKey(item, duplicateOutputNames) === key);
      if (existing && upstream && upstream.length > 0) {
        existing.upstream = mergeColumnRefs(existing.upstream ?? [], upstream);
      }
      if (existing && unresolvedUpstream && unresolvedUpstream.length > 0) {
        existing.unresolvedUpstream = mergeUnresolvedColumnReferences(existing.unresolvedUpstream ?? [], unresolvedUpstream);
      }
      if (existing && comments && comments.length > 0) {
        existing.comments = mergeComments(existing.comments, comments);
      }
      if (existing && caseRules && caseRules.length > 0) {
        existing.caseRules = caseRules;
      }
      if (existing && expressionTree) {
        existing.expressionTree = expressionTree;
      }
      if (existing && expressionSql) {
        existing.expressionSql = expressionSql;
      }
      if (existing && outputIndex !== undefined) {
        existing.outputIndex = outputIndex;
      }
      if (existing && selectItemId) {
        existing.selectItemId = selectItemId;
      }
      if (existing && scopeId) {
        existing.scopeId = scopeId;
      }
      if (existing && usage) {
        existing.usage = mergeColumnUsage(existing.usage, usage);
      }
    }
  }
  node.columns = nextColumns;
}

function createColumnId(nodeId: string, name: string, outputIndex?: number): string {
  const baseId = `${nodeId}.${sanitizeColumnIdFragment(name)}`;
  return outputIndex === undefined ? baseId : `${baseId}.${outputIndex + 1}`;
}

function sanitizeColumnIdFragment(value: string): string {
  const sanitized = sanitizeId(value);
  if (sanitized !== 'unnamed' || value.trim().toLowerCase() === 'unnamed') {
    return sanitized;
  }
  return `u_${hashString(value)}`;
}

function hashString(value: string): string {
  let hash = 5381;
  for (const character of value) {
    hash = ((hash << 5) + hash) ^ character.codePointAt(0)!;
  }
  return (hash >>> 0).toString(36);
}

function collectDuplicateOutputColumnNames(columns: Array<string | LineageColumn>): Set<string> {
  const counts = new Map<string, number>();
  for (const column of columns) {
    if (typeof column === 'string' || column.outputIndex === undefined) {
      continue;
    }
    counts.set(column.name, (counts.get(column.name) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

function columnStorageKey(column: Pick<LineageColumn, 'name' | 'outputIndex'>, duplicateOutputNames: Set<string>): string {
  return duplicateOutputNames.has(column.name) && column.outputIndex !== undefined ? `${column.name}:${column.outputIndex}` : column.name;
}

function classifyColumnUsage(nodes: Map<string, LineageNode>): void {
  const valueUsed = new Set<string>();
  const conditionUsed = new Set<string>();

  for (const node of nodes.values()) {
    for (const column of node.columns) {
      if (column.usage?.role === 'filter') {
        continue;
      }
      for (const upstream of column.upstream ?? []) {
        valueUsed.add(columnKey(upstream.nodeId, upstream.columnName));
      }
      if (column.usage?.role === 'condition') {
        conditionUsed.add(columnKey(node.id, column.name));
      }
    }
  }

  for (const node of nodes.values()) {
    if (node.type === 'output') {
      continue;
    }

    node.columns = node.columns.map((column) => {
      const key = columnKey(node.id, column.name);
      if (column.usage?.role === 'condition' && column.usage.reasons?.includes('subquery') && node.type !== 'table') {
        return column;
      }
      if (valueUsed.has(key)) {
        return { ...column, usage: undefined };
      }
      if (conditionUsed.has(key)) {
        if (node.type === 'table') {
          return { ...column, usage: undefined };
        }
        return {
          ...column,
          usage: {
            role: 'condition',
            reasons: column.usage?.reasons,
          },
        };
      }
      if (node.type !== 'table') {
        return {
          ...column,
          usage: {
            role: 'unused',
          },
        };
      }
      return column;
    });
  }
}

function mergeColumnUsage(left: LineageColumn['usage'], right: LineageColumn['usage']): LineageColumn['usage'] {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  if (left.role === 'unused' || right.role === 'unused') {
    return left.role === 'unused' ? left : right;
  }
  if (left.role === 'filter' || right.role === 'filter') {
    return left.role === 'filter' ? left : right;
  }
  if (left.reasons?.includes('groupBy')) {
    return left;
  }
  if (right.reasons?.includes('groupBy')) {
    return right;
  }
  return {
    role: 'condition',
    reasons: dedupeUsageReasons([...(left.reasons ?? []), ...(right.reasons ?? [])]),
  };
}

function dedupeUsageReasons(reasons: LineageColumnUsageReason[]): LineageColumnUsageReason[] {
  return [...new Set(reasons)];
}

function columnKey(nodeId: string, columnName: string): string {
  return `${nodeId}.${columnName}`;
}

function formatExpressionSql(value: unknown): string | undefined {
  try {
    const formatted = expressionFormatter.format(value as Parameters<SqlFormatter['format']>[0]).formattedSql.trim();
    return formatted.length > 0 ? formatted : undefined;
  } catch {
    return undefined;
  }
}

function extractSelectItemComments(items: SimpleSelectQuery['selectClause']['items'], index: number): string[] | undefined {
  const item = items[index];
  const nextItem = items[index + 1];
  return mergeComments(
    extractComments(item, item.value, item.identifier, (item as { aliasPositionedComments?: unknown }).aliasPositionedComments),
    extractPositionedComments(nextItem, 'before'),
  );
}

function extractQueryNodeComments(query: unknown): string[] | undefined {
  return mergeComments(extractComments(query), extractHeaderComments(query));
}

function extractCteComments(cte: CommonTable): string[] | undefined {
  return mergeComments(
    extractComments(cte, cte.aliasExpression, cte.aliasExpression?.table),
    extractHeaderComments((cte as { query?: unknown }).query),
  );
}

function extractComments(...values: unknown[]): string[] | undefined {
  const comments: string[] = [];
  for (const value of values) {
    comments.push(...extractLegacyComments(value));
    comments.push(...extractPositionedComments(value));
  }
  return comments.length > 0 ? dedupeComments(comments) : undefined;
}

function extractLegacyComments(value: unknown): string[] {
  if (!value || typeof value !== 'object' || !('comments' in value)) {
    return [];
  }
  const comments = (value as { comments?: unknown }).comments;
  return Array.isArray(comments) ? normalizeComments(comments) : [];
}

function extractHeaderComments(value: unknown): string[] | undefined {
  if (!value || typeof value !== 'object' || !('headerComments' in value)) {
    return undefined;
  }
  const comments = (value as { headerComments?: unknown }).headerComments;
  if (!Array.isArray(comments)) {
    return undefined;
  }
  const normalized = normalizeComments(comments);
  return normalized.length > 0 ? normalized : undefined;
}

function extractPositionedComments(value: unknown, position?: 'before' | 'after'): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const positionedComments = Array.isArray(value)
    ? value
    : 'positionedComments' in value
      ? (value as { positionedComments?: unknown }).positionedComments
      : undefined;
  if (!Array.isArray(positionedComments)) {
    return [];
  }

  return positionedComments.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const positioned = item as { comments?: unknown; position?: unknown };
    if (position && positioned.position !== position) {
      return [];
    }
    return Array.isArray(positioned.comments) ? normalizeComments(positioned.comments) : [];
  });
}

function mergeComments(left?: string[], right?: string[]): string[] | undefined {
  const comments = dedupeComments([...(left ?? []), ...(right ?? [])]);
  return comments.length > 0 ? comments : undefined;
}

function normalizeComments(comments: unknown[]): string[] {
  return comments.map((comment) => String(comment).trim()).filter((comment) => comment.length > 0);
}

function dedupeComments(comments: string[]): string[] {
  return [...new Set(comments)];
}

function mergeUnresolvedColumnReferences(
  left: LineageUnresolvedColumnReference[],
  right: LineageUnresolvedColumnReference[],
): LineageUnresolvedColumnReference[] {
  const merged: LineageUnresolvedColumnReference[] = [];
  const seen = new Set<string>();
  for (const ref of [...left, ...right]) {
    const key = `${ref.reason}:${ref.qualifier ?? ''}:${ref.columnName}:${ref.candidateNodeIds?.join(',') ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(ref);
    }
  }
  return merged;
}

function createTableNode(tableName: string, nodes: Map<string, LineageNode>, schemaFacts?: SchemaFacts): LineageNode {
  const id = toTableId(tableName);
  const existing = nodes.get(id);
  if (existing) {
    if (existing.columns.length === 0) {
      const columnNames = resolveSchemaColumnNames(schemaFacts, tableName);
      if (columnNames.length > 0) {
        setNodeColumns(nodes, existing.id, columnNames);
      }
    }
    return existing;
  }
  const columnNames = resolveSchemaColumnNames(schemaFacts, tableName);
  const node: LineageNode = {
    id,
    type: 'table',
    label: tableName,
    columns: columnNames.length > 0
      ? columnNames.map((name) => ({
          id: `${id}.${sanitizeId(name)}`,
          name,
        }))
      : [],
  };
  nodes.set(id, node);
  return node;
}

function createParameterTableNode(label: string, nodes: Map<string, LineageNode>): LineageNode {
  const normalizedLabel = isDualTableName(label) ? 'dual' : label;
  const id = toParameterTableId(normalizedLabel);
  const existing = nodes.get(id);
  if (existing) {
    return existing;
  }
  const node: LineageNode = {
    id,
    type: 'parameter_table',
    label: normalizedLabel === 'parameters' ? 'Parameters' : normalizedLabel,
    columns: [],
  };
  nodes.set(id, node);
  return node;
}

function resolveSchemaColumnNames(schemaFacts: SchemaFacts | undefined, tableName: string): string[] {
  return schemaFacts ? createTableColumnResolver(schemaFacts)(tableName) : [];
}

function createCteNode(cteName: string, nodes: Map<string, LineageNode>): LineageNode {
  const node: LineageNode = {
    id: toCteId(cteName),
    type: 'cte',
    label: cteName,
    columns: [],
    materializationHint: 'none',
  };
  nodes.set(node.id, node);
  return node;
}

function findCteSourceNode(cteName: string, nodes: Map<string, LineageNode>): LineageNode {
  const parameterNode = nodes.get(toParameterTableId(cteName));
  if (parameterNode) {
    return parameterNode;
  }
  return nodes.get(toCteId(cteName)) ?? createCteNode(cteName, nodes);
}

function createDerivedNode(id: string, label: string, nodes: Map<string, LineageNode>): LineageNode {
  const existing = nodes.get(id);
  if (existing) {
    return existing;
  }
  const node: LineageNode = {
    id,
    type: 'derived',
    label,
    columns: [],
  };
  nodes.set(id, node);
  return node;
}

function addLineageEdge(edges: LineageEdge[], edge: Omit<LineageEdge, 'id'>): void {
  const baseId = `${edge.source}-${edge.target}`;
  edges.push({
    ...edge,
    id: edges.some((existing) => existing.id === baseId) ? uniqueEdgeId(baseId, edge, edges) : baseId,
  });
}

function uniqueEdgeId(baseId: string, edge: Omit<LineageEdge, 'id'>, edges: LineageEdge[]): string {
  const parts = [edge.type, edge.label, edge.sourceAlias].filter((part): part is string => Boolean(part));
  const suffix = sanitizeId(parts.join('_')) || 'edge';
  let id = `${baseId}-${suffix}`;
  let counter = 2;
  while (edges.some((existing) => existing.id === id)) {
    id = `${baseId}-${suffix}_${counter}`;
    counter += 1;
  }
  return id;
}

function normalizeJoinLabel(join: JoinClause): string {
  const value = join.joinType.value.trim();
  return value.length > 0 ? value.toUpperCase() : 'JOIN';
}

function normalizeJoinType(join: JoinClause): 'inner' | 'left' | 'right' | 'full' | 'unknown' {
  const normalized = join.joinType.value.toLowerCase();
  if (normalized.includes('left')) {
    return 'left';
  }
  if (normalized.includes('right')) {
    return 'right';
  }
  if (normalized.includes('full')) {
    return 'full';
  }
  if (normalized.includes('join')) {
    return 'inner';
  }
  return 'unknown';
}

function toJoinNullability(joinType: ReturnType<typeof normalizeJoinType>): LineageEdge['joinNullability'] {
  if (joinType === 'inner' || joinType === 'unknown') {
    return undefined;
  }
  return {
    reason: 'outerJoin',
    joinType,
  };
}

function normalizeMaterializationHint(materialized: CommonTable['materialized']): LineageNode['materializationHint'] {
  if (materialized === true) {
    return 'MATERIALIZED';
  }
  if (materialized === false) {
    return 'NOT MATERIALIZED';
  }
  return 'none';
}

function toTableId(tableName: string): string {
  return `table_${sanitizeId(tableName)}`;
}

function toParameterTableId(tableName: string): string {
  return `parameter_${sanitizeId(tableName)}`;
}

function toCteId(cteName: string): string {
  return `cte_${sanitizeId(cteName)}`;
}

function isDualTableName(tableName: string): boolean {
  return tableName.split('.').at(-1)?.toLowerCase() === 'dual';
}

function isParameterSelectQuery(query: unknown): query is SimpleSelectQuery {
  return query instanceof SimpleSelectQuery && !query.fromClause;
}

function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'unnamed';
}

function dedupeEdges(edges: LineageEdge[]): LineageEdge[] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.source}|${edge.target}|${edge.type}|${edge.kind ?? ''}|${edge.label ?? ''}|${edge.sourceAlias ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
