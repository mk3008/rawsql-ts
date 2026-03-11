import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BinaryExpression,
  BinarySelectQuery,
  ColumnReference,
  CommonTable,
  DeleteQuery,
  FromClause,
  InlineQuery,
  InsertQuery,
  LimitClause,
  LiteralValue,
  ParameterExpression,
  RawString,
  IdentifierString,
  SelectClause,
  SelectItem,
  SimpleSelectQuery,
  SourceAliasExpression,
  SourceExpression,
  SqlFormatter,
  SqlParser,
  SubQuerySource,
  TableSource,
  UpdateQuery,
  ValuesQuery,
  WithClause
} from 'rawsql-ts';
import {
  analyzeStatement,
  assertSupportedStatement,
  collectDependencyClosure,
  collectReachableCtes,
  type QueryAnalysis,
  type SupportedStatement
} from './analysis';
import { buildQueryPipelinePlan, type QueryPipelineMetadata, type QueryPipelinePlan } from './planner';

export type PipelineRow = Record<string, unknown>;

export type PipelineQueryResult =
  | PipelineRow[]
  | {
      rows: PipelineRow[];
      rowCount?: number;
    };

export interface QueryPipelineSession {
  query(sql: string, params?: unknown[] | Record<string, unknown>): Promise<PipelineQueryResult>;
  release?(): void | Promise<void>;
  end?(): void | Promise<void>;
}

export interface QueryPipelineSessionFactory {
  openSession(): Promise<QueryPipelineSession>;
}

export interface ExecuteQueryPipelineOptions {
  sqlFile: string;
  metadata?: QueryPipelineMetadata;
  params?: unknown[] | Record<string, unknown>;
}

export interface QueryPipelineExecutionStepResult {
  kind: 'materialize' | 'scalar-filter-bind' | 'final-query';
  target: string;
  sql: string;
  params?: unknown[] | Record<string, unknown>;
  rowCount?: number;
}

export interface QueryPipelineExecutionResult {
  plan: QueryPipelinePlan;
  final: {
    rows: PipelineRow[];
    rowCount?: number;
    sql: string;
    params?: unknown[] | Record<string, unknown>;
  };
  steps: QueryPipelineExecutionStepResult[];
}

interface PipelineStageQuery {
  sql: string;
  params?: unknown[] | Record<string, unknown>;
  scalarSteps: QueryPipelineExecutionStepResult[];
}

interface PreparedPipelineSource {
  absolutePath: string;
  sql: string;
}

interface BuildPipelineStageQueryOptions {
  cte?: string;
  final?: boolean;
  runtimeParams?: unknown[] | Record<string, unknown>;
  materializedCtes: string[];
  limit?: number;
  scalarFilterColumns: string[];
}

interface ScalarBindingContext {
  runtimeParams?: unknown[] | Record<string, unknown>;
  scalarFilterColumns: Set<string>;
  stageCteNames: Set<string>;
  materializedCtes: Set<string>;
  nextOrdinal: number;
}

interface ScalarBindingCandidate {
  columnName: string;
  inlineQuery: InlineQuery;
  replace: (expression: ParameterExpression) => void;
}

interface ScalarExecutionResult {
  paramName: string;
  value: unknown;
  step: QueryPipelineExecutionStepResult;
}

const SUPPORTED_COMPARISON_OPERATORS = new Set(['=', '!=', '<>', '>', '>=', '<', '<=']);

/**
 * Execute a decomposed query pipeline inside one DB session and reuse prior stage outputs.
 */
export async function executeQueryPipeline(
  sessionFactory: QueryPipelineSessionFactory,
  options: ExecuteQueryPipelineOptions
): Promise<QueryPipelineExecutionResult> {
  const source = preparePipelineSource(options.sqlFile);
  const plan = buildQueryPipelinePlan(options.sqlFile, options.metadata);
  const session = await sessionFactory.openSession();
  const materializedCtes: string[] = [];
  const createdTempTables: string[] = [];
  const steps: QueryPipelineExecutionStepResult[] = [];
  let executionError: unknown;

  try {
    for (const step of plan.steps) {
      if (step.kind === 'materialize') {
        const stage = await buildPipelineStageQuery(source, session, {
          cte: step.target,
          runtimeParams: options.params,
          materializedCtes,
          scalarFilterColumns: plan.metadata.scalarFilterColumns
        });
        steps.push(...stage.scalarSteps);

        const sql = `create temp table ${quoteIdentifier(step.target)} as ${stage.sql.trim()}`;
        const result = normalizePipelineQueryResult(await session.query(sql, stage.params));
        materializedCtes.push(step.target);
        createdTempTables.push(step.target);
        steps.push({
          kind: step.kind,
          target: step.target,
          sql,
          params: stage.params,
          rowCount: result.rowCount
        });
        continue;
      }

      const finalStage = await buildPipelineStageQuery(source, session, {
        final: true,
        runtimeParams: options.params,
        materializedCtes,
        scalarFilterColumns: plan.metadata.scalarFilterColumns
      });
      steps.push(...finalStage.scalarSteps);

      const result = normalizePipelineQueryResult(await session.query(finalStage.sql, finalStage.params));
      steps.push({
        kind: step.kind,
        target: step.target,
        sql: finalStage.sql,
        params: finalStage.params,
        rowCount: result.rowCount
      });
      return {
        plan,
        final: {
          rows: result.rows,
          rowCount: result.rowCount,
          sql: finalStage.sql,
          params: finalStage.params
        },
        steps
      };
    }

    throw new Error('Query pipeline plan did not include a final-query step.');
  } catch (error) {
    executionError = error;
    throw error;
  } finally {
    await cleanupPipelineSession(session, createdTempTables, executionError);
  }
}

async function buildPipelineStageQuery(
  source: PreparedPipelineSource,
  session: QueryPipelineSession,
  options: BuildPipelineStageQueryOptions
): Promise<PipelineStageQuery> {
  validateStageOptions(options);
  return options.cte
    ? buildTargetStageQuery(source, session, options)
    : buildFinalStageQuery(source, session, options);
}

async function buildTargetStageQuery(
  source: PreparedPipelineSource,
  session: QueryPipelineSession,
  options: BuildPipelineStageQueryOptions
): Promise<PipelineStageQuery> {
  const parsed = assertSupportedStatement(SqlParser.parse(source.sql), 'executeQueryPipeline');
  const analysis = analyzeStatement(parsed);
  const targetName = options.cte as string;
  const materializedStopSet = new Set(options.materializedCtes.filter((name) => name !== targetName));
  const includedNames = collectDependencyClosure(targetName, analysis.dependencyMap, materializedStopSet);
  if (!includedNames.includes(targetName)) {
    throw new Error(`CTE not found in query: ${targetName}`);
  }

  const includedCtes = buildStageCtes(analysis.ctes, includedNames, targetName, options.materializedCtes);
  const targetCte = includedCtes.find((cte) => cte.aliasExpression.table.name === targetName);
  if (!targetCte) {
    throw new Error(`CTE not found in query: ${targetName}`);
  }

  const dependencyCtes = includedCtes.filter((cte) => cte.aliasExpression.table.name !== targetName);
  const bindingContext = createScalarBindingContext(options, includedNames);
  const scalarSteps = await bindScalarFilterPredicatesInCtes(includedCtes, bindingContext, session);
  const formatter = createPipelineFormatter(options.runtimeParams);
  const targetQuery = assertSelectQuery(targetCte.query);
  const withComponent = dependencyCtes.length > 0 ? new WithClause(getWithClause(parsed)?.recursive ?? false, dependencyCtes) : null;
  const withResult = withComponent
    ? formatter.format(withComponent)
    : { formattedSql: '', params: emptyFormatterParams(options.runtimeParams) };

  let mainResult: { formattedSql: string; params: unknown[] | Record<string, unknown> };
  if (options.limit !== undefined) {
    if (targetQuery instanceof SimpleSelectQuery) {
      targetQuery.limitClause = new LimitClause(new LiteralValue(options.limit));
      mainResult = formatter.format(targetQuery);
    } else {
      mainResult = formatter.format(buildWrappedLimitQuery(targetQuery, options.limit));
    }
  } else {
    mainResult = formatter.format(targetQuery);
  }

  const mergedParams = mergeFormatterParams([withResult.params, mainResult.params], options.runtimeParams);
  const sql = withResult.formattedSql ? `${withResult.formattedSql} ${mainResult.formattedSql}` : mainResult.formattedSql;

  return {
    sql: `${sql}\n`,
    params: mergedParams,
    scalarSteps
  };

}

async function buildFinalStageQuery(
  source: PreparedPipelineSource,
  session: QueryPipelineSession,
  options: BuildPipelineStageQueryOptions
): Promise<PipelineStageQuery> {
  const parsed = assertSupportedStatement(SqlParser.parse(source.sql), 'executeQueryPipeline');
  const analysis = analyzeStatement(parsed);
  const stopSet = new Set(options.materializedCtes);
  const includedNames = [...collectReachableCtes(analysis.rootDependencies, analysis.dependencyMap, stopSet)];
  const includedCtes = buildStageCtes(analysis.ctes, includedNames, null, options.materializedCtes);
  const bindingContext = createScalarBindingContext(options, includedNames);

  applyMinimalWithClause(parsed, includedCtes, getWithClause(parsed)?.recursive ?? false);
  const scalarSteps = [
    ...(await bindScalarFilterPredicatesInCtes(includedCtes, bindingContext, session)),
    ...(await bindScalarFilterPredicates(parsed, bindingContext, session))
  ];
  const formatter = createPipelineFormatter(options.runtimeParams);

  if (options.limit !== undefined) {
    if (parsed instanceof SimpleSelectQuery) {
      parsed.limitClause = new LimitClause(new LiteralValue(options.limit));
    } else if (parsed instanceof ValuesQuery || parsed instanceof BinarySelectQuery) {
      const wrapped = buildWrappedLimitQuery(parsed, options.limit);
      const { formattedSql, params } = formatter.format(wrapped);
      return {
        sql: `${formattedSql}\n`,
        params: mergeFormatterParams(params, options.runtimeParams),
        scalarSteps
      };
    } else {
      throw new Error('--limit is only supported for SELECT final slices or --cte slices.');
    }
  }

  const { formattedSql, params } = formatter.format(parsed);
  return {
    sql: `${formattedSql}\n`,
    params: mergeFormatterParams(params, options.runtimeParams),
    scalarSteps
  };
}

function createScalarBindingContext(
  options: BuildPipelineStageQueryOptions,
  includedNames: string[]
): ScalarBindingContext {
  return {
    runtimeParams: options.runtimeParams,
    scalarFilterColumns: new Set(options.scalarFilterColumns),
    stageCteNames: new Set(includedNames),
    materializedCtes: new Set(options.materializedCtes),
    nextOrdinal: 1
  };
}

function buildStageCtes(
  ctes: CommonTable[],
  includedNames: string[],
  currentTarget: string | null,
  materializedCtes: string[]
): CommonTable[] {
  const includedSet = new Set(includedNames);
  const materializedSet = new Set(materializedCtes);

  return ctes.filter((cte) => {
    const name = cte.aliasExpression.table.name;
    if (!includedSet.has(name)) {
      return false;
    }

    return name === currentTarget || !materializedSet.has(name);
  });
}

async function bindScalarFilterPredicatesInCtes(
  ctes: CommonTable[],
  context: ScalarBindingContext,
  session: QueryPipelineSession
): Promise<QueryPipelineExecutionStepResult[]> {
  const steps: QueryPipelineExecutionStepResult[] = [];
  for (const cte of ctes) {
    steps.push(...await bindScalarFilterPredicates(assertSelectQuery(cte.query), context, session));
  }
  return steps;
}
async function bindScalarFilterPredicates(
  statement: SupportedStatement | SimpleSelectQuery,
  context: ScalarBindingContext,
  session: QueryPipelineSession
): Promise<QueryPipelineExecutionStepResult[]> {
  if (context.scalarFilterColumns.size === 0) {
    return [];
  }

  if (statement instanceof SimpleSelectQuery) {
    return bindScalarFilterPredicatesInSelect(statement, context, session);
  }

  if (statement instanceof BinarySelectQuery) {
    const steps: QueryPipelineExecutionStepResult[] = [];
    steps.push(...await bindScalarFilterPredicatesInSelectBranch(assertSelectQuery(statement.left), context, session));
    steps.push(...await bindScalarFilterPredicatesInSelectBranch(assertSelectQuery(statement.right), context, session));
    return steps;
  }

  if (statement instanceof ValuesQuery) {
    return [];
  }

  if (statement instanceof InsertQuery) {
    return statement.selectQuery
      ? bindScalarFilterPredicatesInSelectBranch(assertSelectQuery(statement.selectQuery), context, session)
      : [];
  }

  if (statement instanceof UpdateQuery || statement instanceof DeleteQuery) {
    return [];
  }

  return [];
}

async function bindScalarFilterPredicatesInSelectBranch(
  statement: SimpleSelectQuery | BinarySelectQuery | ValuesQuery,
  context: ScalarBindingContext,
  session: QueryPipelineSession
): Promise<QueryPipelineExecutionStepResult[]> {
  if (statement instanceof SimpleSelectQuery) {
    return bindScalarFilterPredicatesInSelect(statement, context, session);
  }
  if (statement instanceof BinarySelectQuery) {
    const steps: QueryPipelineExecutionStepResult[] = [];
    steps.push(...await bindScalarFilterPredicatesInSelectBranch(assertSelectQuery(statement.left), context, session));
    steps.push(...await bindScalarFilterPredicatesInSelectBranch(assertSelectQuery(statement.right), context, session));
    return steps;
  }
  return [];
}

async function bindScalarFilterPredicatesInSelect(
  selectQuery: SimpleSelectQuery,
  context: ScalarBindingContext,
  session: QueryPipelineSession
): Promise<QueryPipelineExecutionStepResult[]> {
  if (!selectQuery.whereClause) {
    return [];
  }

  return rewritePredicateExpression(selectQuery.whereClause.condition, context, session);
}

async function rewritePredicateExpression(
  expression: unknown,
  context: ScalarBindingContext,
  session: QueryPipelineSession
): Promise<QueryPipelineExecutionStepResult[]> {
  if (!(expression instanceof BinaryExpression)) {
    return [];
  }

  const binaryExpression = expression;
  const candidate = findScalarBindingCandidate(binaryExpression, context.scalarFilterColumns);
  if (candidate) {
    const execution = await executeScalarFilterBinding(candidate, context, session);
    if (execution) {
      candidate.replace(new ParameterExpression(execution.paramName, execution.value as never));
      return [execution.step];
    }
  }

  const steps: QueryPipelineExecutionStepResult[] = [];
  steps.push(...await rewritePredicateExpression(binaryExpression.left, context, session));
  steps.push(...await rewritePredicateExpression(binaryExpression.right, context, session));
  return steps;
}
function findScalarBindingCandidate(
  expression: BinaryExpression,
  scalarFilterColumns: ReadonlySet<string>
): ScalarBindingCandidate | null {
  const operator = extractOperator(expression.operator);
  if (!SUPPORTED_COMPARISON_OPERATORS.has(operator)) {
    return null;
  }

  const leftMatches = containsTargetColumn(expression.left, scalarFilterColumns);
  const rightMatches = containsTargetColumn(expression.right, scalarFilterColumns);
  const leftInline = unwrapInlineQuery(expression.left);
  const rightInline = unwrapInlineQuery(expression.right);

  if (leftMatches && rightInline) {
    return {
      columnName: leftMatches,
      inlineQuery: rightInline,
      replace: (parameter) => {
        expression.right = parameter;
      }
    };
  }

  if (rightMatches && leftInline) {
    return {
      columnName: rightMatches,
      inlineQuery: leftInline,
      replace: (parameter) => {
        expression.left = parameter;
      }
    };
  }

  return null;
}

async function executeScalarFilterBinding(
  candidate: ScalarBindingCandidate,
  context: ScalarBindingContext,
  session: QueryPipelineSession
): Promise<ScalarExecutionResult | null> {
  const selectQuery = candidate.inlineQuery.selectQuery;
  if (!(selectQuery instanceof SimpleSelectQuery)) {
    throw new Error(`Scalar filter binding for column "${candidate.columnName}" requires a simple SELECT subquery.`);
  }

  if (isCorrelatedScalarSubquery(selectQuery)) {
    return null;
  }

  if (dependsOnStageCtes(selectQuery, context.stageCteNames, context.materializedCtes)) {
    return null;
  }

  assertSingleColumnScalarSelect(selectQuery, candidate.columnName);
  const paramName = `__scalar_filter_${candidate.columnName}_${context.nextOrdinal}`;
  const formatter = createPipelineFormatter(context.runtimeParams);
  const { formattedSql, params } = formatter.format(selectQuery);
  const queryParams = mergeFormatterParams(params, context.runtimeParams);
  const sql = `${formattedSql}\n`;
  const result = normalizePipelineQueryResult(await session.query(sql, queryParams));
  const value = extractScalarFilterValue(result.rows, candidate.columnName);
  const step: QueryPipelineExecutionStepResult = {
    kind: 'scalar-filter-bind',
    target: candidate.columnName,
    sql,
    params: queryParams,
    rowCount: result.rowCount
  };

  context.nextOrdinal += 1;
  return { paramName, value, step };
}
function assertSingleColumnScalarSelect(selectQuery: SimpleSelectQuery, columnName: string): void {
  if (selectQuery.selectClause.items.length !== 1) {
    throw new Error(`Scalar filter binding for column "${columnName}" requires a subquery that statically exposes exactly one column.`);
  }

  const [item] = selectQuery.selectClause.items;
  if (item?.value instanceof RawString && item.value.value.trim() === '*') {
    throw new Error(`Scalar filter binding for column "${columnName}" requires a subquery that statically exposes exactly one column.`);
  }
}

function extractScalarFilterValue(rows: PipelineRow[], columnName: string): unknown {
  if (rows.length !== 1) {
    throw new Error(`Scalar filter binding for column "${columnName}" must return exactly one row.`);
  }

  const row = rows[0] ?? {};
  const columns = Object.keys(row);
  if (columns.length !== 1) {
    throw new Error(`Scalar filter binding for column "${columnName}" must return exactly one column.`);
  }

  return row[columns[0]];
}

function dependsOnStageCtes(
  selectQuery: SimpleSelectQuery,
  stageCteNames: ReadonlySet<string>,
  materializedCtes: ReadonlySet<string>
): boolean {
  const sources = selectQuery.fromClause?.getSources() ?? [];
  return sources.some((source) => {
    if (!(source.datasource instanceof TableSource)) {
      return false;
    }

    const sourceName = extractQualifiedNameLeaf(source.datasource.qualifiedName.name);
    return stageCteNames.has(sourceName) && !materializedCtes.has(sourceName);
  });
}

function isCorrelatedScalarSubquery(selectQuery: SimpleSelectQuery): boolean {
  const localNames = collectLocalRelationNames(selectQuery);
  const columnReferences = collectColumnReferences(selectQuery);

  return columnReferences.some((reference) => {
    const qualifierParts = reference.qualifiedName.namespaces?.map((namespace) => namespace.name) ?? [];
    if (qualifierParts.length === 0) {
      return false;
    }

    const qualifier = qualifierParts[qualifierParts.length - 1];
    return !localNames.has(qualifier);
  });
}

function collectLocalRelationNames(selectQuery: SimpleSelectQuery): Set<string> {
  const localNames = new Set<string>();
  const sources = selectQuery.fromClause?.getSources() ?? [];

  for (const source of sources) {
    const aliasName = source.aliasExpression?.table?.name;
    if (aliasName) {
      localNames.add(aliasName);
    }

    if (source.datasource instanceof TableSource) {
      localNames.add(extractQualifiedNameLeaf(source.datasource.qualifiedName.name));
    }
  }

  return localNames;
}

function collectColumnReferences(node: unknown): ColumnReference[] {
  const matches: ColumnReference[] = [];
  walkAst(node, (current) => {
    if (current instanceof ColumnReference) {
      matches.push(current);
    }
  });
  return matches;
}

function containsTargetColumn(node: unknown, scalarFilterColumns: ReadonlySet<string>): string | null {
  let matched: string | null = null;
  walkAst(node, (current) => {
    if (matched || !(current instanceof ColumnReference)) {
      return;
    }

    const columnName = extractQualifiedNameLeaf(current.qualifiedName.name);
    if (scalarFilterColumns.has(columnName)) {
      matched = columnName;
    }
  });
  return matched;
}

function walkAst(node: unknown, visit: (current: unknown) => void): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  visit(node);

  for (const value of Object.values(node as Record<string, unknown>)) {
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walkAst(item, visit);
      }
      continue;
    }

    if (typeof value === 'object') {
      walkAst(value, visit);
    }
  }
}

function unwrapInlineQuery(expression: unknown): InlineQuery | null {
  return expression instanceof InlineQuery ? expression : null;
}

function extractOperator(operator: RawString | unknown): string {
  if (operator instanceof RawString) {
    return operator.value.trim();
  }
  return '';
}

function extractQualifiedNameLeaf(name: RawString | IdentifierString): string {
  return name instanceof RawString ? name.value : name.name;
}

function preparePipelineSource(sqlFile: string): PreparedPipelineSource {
  const absolutePath = path.resolve(sqlFile);
  const sql = readFileSync(absolutePath, 'utf8');

  return {
    absolutePath,
    sql
  };
}

function createPipelineFormatter(runtimeParams: unknown[] | Record<string, unknown> | undefined): SqlFormatter {
  if (runtimeParams && !Array.isArray(runtimeParams)) {
    return new SqlFormatter({
      identifierEscape: { start: '"', end: '"' },
      parameterStyle: 'named',
      parameterSymbol: ':'
    });
  }

  return new SqlFormatter({ preset: 'postgres' });
}

function emptyFormatterParams(runtimeParams: unknown[] | Record<string, unknown> | undefined): unknown[] | Record<string, unknown> {
  return Array.isArray(runtimeParams) ? [] : {};
}

function mergeFormatterParams(
  formatterParams: unknown[] | Record<string, unknown> | Array<unknown[] | Record<string, unknown>>,
  runtimeParams: unknown[] | Record<string, unknown> | undefined
): unknown[] | Record<string, unknown> | undefined {
  const parts = Array.isArray(formatterParams) && formatterParams.some((part) => Array.isArray(part) || isPlainObject(part))
    ? (formatterParams as Array<unknown[] | Record<string, unknown>>)
    : [formatterParams as unknown[] | Record<string, unknown>];

  if ((runtimeParams && !Array.isArray(runtimeParams)) || parts.some((part) => isPlainObject(part))) {
    const merged: Record<string, unknown> = isPlainObject(runtimeParams) ? { ...runtimeParams } : {};

    // Preserve original runtime params while layering formatter-generated named values on top.
    for (const part of parts) {
      if (!isPlainObject(part)) {
        continue;
      }

      for (const [key, value] of Object.entries(part)) {
        if (value === undefined || (value === null && key in merged)) {
          continue;
        }
        merged[key] = value;
      }
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  const merged: unknown[] = Array.isArray(runtimeParams) ? [...runtimeParams] : [];
  for (const part of parts) {
    if (Array.isArray(part)) {
      merged.push(...part);
    }
  }

  return merged.length > 0 ? merged : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePipelineQueryResult(result: PipelineQueryResult): { rows: PipelineRow[]; rowCount?: number } {
  if (Array.isArray(result)) {
    return { rows: result };
  }

  return {
    rows: result.rows,
    rowCount: result.rowCount
  };
}

async function cleanupPipelineSession(
  session: QueryPipelineSession,
  createdTempTables: string[],
  executionError: unknown
): Promise<void> {
  let cleanupError: unknown;

  // Keep dropping later tables even if one cleanup statement fails.
  for (const tableName of [...createdTempTables].reverse()) {
    try {
      await session.query(`drop table if exists ${quoteIdentifier(tableName)}`);
    } catch (error) {
      if (!cleanupError) {
        cleanupError = error;
      }
    }
  }

  try {
    await closePipelineSession(session);
  } catch (error) {
    if (!executionError && !cleanupError) {
      throw error;
    }
  }

  if (!executionError && cleanupError) {
    throw cleanupError;
  }
}

async function closePipelineSession(session: QueryPipelineSession): Promise<void> {
  if (typeof session.release === 'function') {
    await session.release();
    return;
  }

  if (typeof session.end === 'function') {
    await session.end();
  }
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function validateStageOptions(options: BuildPipelineStageQueryOptions): void {
  const hasTarget = typeof options.cte === 'string' && options.cte.trim() !== '';
  const hasFinal = options.final === true;

  if (hasTarget === hasFinal) {
    throw new Error('Specify exactly one stage target or final query mode.');
  }
}

function buildSelectFromTargetQuery(targetName: string, limit: number | undefined): SimpleSelectQuery {
  return new SimpleSelectQuery({
    selectClause: new SelectClause([new SelectItem(new RawString('*'))]),
    fromClause: new FromClause(new SourceExpression(new TableSource(null, targetName), null), null),
    limitClause: limit === undefined ? null : new LimitClause(new LiteralValue(limit))
  });
}

function buildWrappedLimitQuery(statement: BinarySelectQuery | ValuesQuery, limit: number): SimpleSelectQuery {
  return new SimpleSelectQuery({
    selectClause: new SelectClause([new SelectItem(new RawString('*'))]),
    fromClause: new FromClause(
      new SourceExpression(new SubQuerySource(statement), new SourceAliasExpression('final_slice', null)),
      null
    ),
    limitClause: new LimitClause(new LiteralValue(limit))
  });
}

function applyMinimalWithClause(statement: SupportedStatement, ctes: CommonTable[], recursive: boolean): void {
  const nextWithClause = ctes.length > 0 ? new WithClause(recursive, ctes) : null;

  if (
    statement instanceof SimpleSelectQuery ||
    statement instanceof ValuesQuery ||
    statement instanceof UpdateQuery ||
    statement instanceof DeleteQuery
  ) {
    statement.withClause = nextWithClause;
    return;
  }

  if (statement instanceof InsertQuery) {
    if (!statement.selectQuery) {
      return;
    }

    // INSERT ... SELECT stores the CTEs on the nested selectQuery, not on InsertQuery itself.
    applyMinimalWithClauseToSelect(assertSelectQuery(statement.selectQuery), nextWithClause);
    return;
  }

  applyMinimalWithClauseToSelect(statement, nextWithClause);
}

function applyMinimalWithClauseToSelect(
  statement: SimpleSelectQuery | BinarySelectQuery | ValuesQuery,
  withClause: WithClause | null
): void {
  if (statement instanceof SimpleSelectQuery || statement instanceof ValuesQuery) {
    statement.withClause = withClause;
    return;
  }

  let current: BinarySelectQuery | SimpleSelectQuery | ValuesQuery = statement;
  while (current instanceof BinarySelectQuery) {
    if (current.left instanceof BinarySelectQuery) {
      current = current.left;
      continue;
    }

    if (current.left instanceof SimpleSelectQuery || current.left instanceof ValuesQuery) {
      current.left.withClause = withClause;
      return;
    }

    break;
  }

  throw new Error('Unable to apply rewritten WITH clause to the final query.');
}

function getWithClause(statement: SupportedStatement): WithClause | null {
  if (
    statement instanceof SimpleSelectQuery ||
    statement instanceof ValuesQuery ||
    statement instanceof UpdateQuery ||
    statement instanceof DeleteQuery
  ) {
    return statement.withClause ?? null;
  }

  if (statement instanceof InsertQuery) {
    return statement.selectQuery ? getSelectWithClause(assertSelectQuery(statement.selectQuery)) : null;
  }

  return getSelectWithClause(statement);
}

function assertSelectQuery(statement: unknown): SimpleSelectQuery | BinarySelectQuery | ValuesQuery {
  if (
    statement instanceof SimpleSelectQuery ||
    statement instanceof BinarySelectQuery ||
    statement instanceof ValuesQuery
  ) {
    return statement;
  }

  throw new Error('Expected a SELECT-compatible statement for query execution.');
}

function getSelectWithClause(statement: SimpleSelectQuery | BinarySelectQuery | ValuesQuery): WithClause | null {
  if (statement instanceof SimpleSelectQuery || statement instanceof ValuesQuery) {
    return statement.withClause ?? null;
  }

  let current: BinarySelectQuery | SimpleSelectQuery | ValuesQuery = statement;
  while (current instanceof BinarySelectQuery) {
    if (current.left instanceof BinarySelectQuery) {
      current = current.left;
      continue;
    }

    if (current.left instanceof SimpleSelectQuery || current.left instanceof ValuesQuery) {
      return current.left.withClause ?? null;
    }

    break;
  }

  return null;
}
