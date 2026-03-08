import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BinarySelectQuery,
  CommonTable,
  DeleteQuery,
  FromClause,
  InsertQuery,
  LimitClause,
  LiteralValue,
  ParameterExpression,
  RawString,
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
  WithClause,
  type SqlParameterValue
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
  kind: 'materialize' | 'scalar-materialize' | 'final-query';
  target: string;
  sql: string;
  params?: unknown[] | Record<string, unknown>;
  rowCount?: number;
  scalarValue?: unknown;
}

export interface QueryPipelineExecutionResult {
  plan: QueryPipelinePlan;
  scalarMaterials: Record<string, unknown>;
  final: {
    rows: PipelineRow[];
    rowCount?: number;
    sql: string;
    params?: unknown[] | Record<string, unknown>;
  };
  steps: QueryPipelineExecutionStepResult[];
}

interface ScalarMaterialBinding {
  target: string;
  columnName: string;
  value: SqlParameterValue;
  paramName: string;
}

interface PipelineStageQuery {
  sql: string;
  params?: unknown[] | Record<string, unknown>;
}

interface PreparedPipelineSource {
  absolutePath: string;
  sql: string;
  analysis: QueryAnalysis;
  recursive: boolean;
}

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
  const scalarBindings = new Map<string, ScalarMaterialBinding>();
  const steps: QueryPipelineExecutionStepResult[] = [];
  const scalarMaterials: Record<string, unknown> = {};
  let executionError: unknown;

  try {
    for (const step of plan.steps) {
      if (step.kind === 'materialize') {
        const stage = buildPipelineStageQuery(source, {
          cte: step.target,
          runtimeParams: options.params,
          materializedCtes,
          scalarBindings
        });
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

      if (step.kind === 'scalar-materialize') {
        const stage = buildPipelineStageQuery(source, {
          cte: step.target,
          runtimeParams: options.params,
          materializedCtes,
          scalarBindings
        });
        const result = normalizePipelineQueryResult(await session.query(stage.sql, stage.params));
        const scalarBinding = extractScalarBinding(result.rows, step.target, scalarBindings.size + 1);
        scalarBindings.set(step.target, scalarBinding);
        scalarMaterials[step.target] = scalarBinding.value;
        steps.push({
          kind: step.kind,
          target: step.target,
          sql: stage.sql,
          params: stage.params,
          rowCount: result.rowCount,
          scalarValue: scalarBinding.value
        });
        continue;
      }

      const finalStage = buildPipelineStageQuery(source, {
        final: true,
        runtimeParams: options.params,
        materializedCtes,
        scalarBindings
      });
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
        scalarMaterials,
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

interface BuildPipelineStageQueryOptions {
  cte?: string;
  final?: boolean;
  runtimeParams?: unknown[] | Record<string, unknown>;
  materializedCtes: string[];
  scalarBindings: Map<string, ScalarMaterialBinding>;
  limit?: number;
}

function buildPipelineStageQuery(source: PreparedPipelineSource, options: BuildPipelineStageQueryOptions): PipelineStageQuery {
  validateStageOptions(options);

  if (source.analysis.ctes.length === 0) {
    throw new Error('executeQueryPipeline requires a query with at least one CTE.');
  }

  if (options.cte) {
    return buildTargetStageQuery(source, options);
  }

  return buildFinalStageQuery(source, options);
}

function buildTargetStageQuery(
  source: PreparedPipelineSource,
  options: BuildPipelineStageQueryOptions
): PipelineStageQuery {
  const targetName = options.cte as string;
  const materializedStopSet = new Set(options.materializedCtes.filter((name) => name !== targetName));
  const scalarStopSet = new Set([...options.scalarBindings.keys()].filter((name) => name !== targetName));
  const stopSet = new Set([...materializedStopSet, ...scalarStopSet]);
  const includedNames = collectDependencyClosure(targetName, source.analysis.dependencyMap, stopSet);
  if (!includedNames.includes(targetName)) {
    throw new Error(`CTE not found in query: ${targetName}`);
  }

  const includedCtes = buildStageCtes(
    source.analysis.ctes,
    includedNames,
    targetName,
    options.materializedCtes,
    options.scalarBindings
  );
  if (!includedCtes.some((cte) => cte.aliasExpression.table.name === targetName)) {
    throw new Error(`CTE not found in query: ${targetName}`);
  }

  const formatter = createPipelineFormatter(options.runtimeParams);
  const mainQuery = buildSelectFromTargetQuery(targetName, options.limit);
  const sqlComponent = includedCtes.length > 0
    ? new WithClause(source.recursive, includedCtes)
    : null;

  const withResult = sqlComponent
    ? formatter.format(sqlComponent)
    : { formattedSql: '', params: emptyFormatterParams(options.runtimeParams) };
  const mainResult = formatter.format(mainQuery);
  const mergedParams = mergeFormatterParams([withResult.params, mainResult.params], options.runtimeParams);
  const sql = withResult.formattedSql ? `${withResult.formattedSql} ${mainResult.formattedSql}` : mainResult.formattedSql;

  return {
    sql: `${sql}\n`,
    params: mergedParams
  };
}

function buildFinalStageQuery(
  source: PreparedPipelineSource,
  options: BuildPipelineStageQueryOptions
): PipelineStageQuery {
  const parsed = assertSupportedStatement(SqlParser.parse(source.sql), 'executeQueryPipeline');
  const stopSet = new Set([...options.materializedCtes, ...options.scalarBindings.keys()]);
  const includedNames = [...collectReachableCtes(source.analysis.rootDependencies, source.analysis.dependencyMap, stopSet)];
  const includedCtes = buildStageCtes(
    source.analysis.ctes,
    includedNames,
    null,
    options.materializedCtes,
    options.scalarBindings
  );
  const formatter = createPipelineFormatter(options.runtimeParams);

  applyMinimalWithClause(parsed, includedCtes, source.recursive);

  if (options.limit !== undefined) {
    if (parsed instanceof SimpleSelectQuery) {
      parsed.limitClause = new LimitClause(new LiteralValue(options.limit));
    } else if (parsed instanceof ValuesQuery || parsed instanceof BinarySelectQuery) {
      const wrapped = buildWrappedLimitQuery(parsed, options.limit);
      const { formattedSql, params } = formatter.format(wrapped);
      return {
        sql: `${formattedSql}\n`,
        params: mergeFormatterParams(params, options.runtimeParams)
      };
    } else {
      throw new Error('--limit is only supported for SELECT final slices or --cte slices.');
    }
  }

  const { formattedSql, params } = formatter.format(parsed);
  return {
    sql: `${formattedSql}\n`,
    params: mergeFormatterParams(params, options.runtimeParams)
  };
}

function buildStageCtes(
  ctes: CommonTable[],
  includedNames: string[],
  currentTarget: string | null,
  materializedCtes: string[],
  scalarBindings: Map<string, ScalarMaterialBinding>
): CommonTable[] {
  const includedSet = new Set(includedNames);
  const materializedSet = new Set(materializedCtes);

  const stageCtes: CommonTable[] = [];
  for (const cte of ctes) {
    const name = cte.aliasExpression.table.name;
    if (!includedSet.has(name)) {
      continue;
    }

    if (name !== currentTarget && materializedSet.has(name)) {
      continue;
    }

    const scalarBinding = name !== currentTarget ? scalarBindings.get(name) : undefined;
    if (scalarBinding) {
      stageCtes.push(buildScalarBindingCte(cte, scalarBinding));
      continue;
    }

    stageCtes.push(cte);
  }

  return stageCtes;
}

function buildScalarBindingCte(sourceCte: CommonTable, binding: ScalarMaterialBinding): CommonTable {
  const aliasColumns = sourceCte.aliasExpression.columns?.map((column) => column.name) ?? null;
  if (aliasColumns && aliasColumns.length > 1) {
    throw new Error(`Scalar material "${binding.target}" must expose exactly one column.`);
  }

  const columnName = aliasColumns?.[0] ?? binding.columnName;
  const query = new SimpleSelectQuery({
    selectClause: new SelectClause([
      new SelectItem(new ParameterExpression(binding.paramName, binding.value), columnName)
    ])
  });

  return new CommonTable(
    query,
    new SourceAliasExpression(sourceCte.aliasExpression.table.name, aliasColumns),
    sourceCte.materialized
  );
}

function preparePipelineSource(sqlFile: string): PreparedPipelineSource {
  const absolutePath = path.resolve(sqlFile);
  const sql = readFileSync(absolutePath, 'utf8');
  const statement = assertSupportedStatement(SqlParser.parse(sql), 'executeQueryPipeline');
  const analysis = analyzeStatement(statement);

  return {
    absolutePath,
    sql,
    analysis,
    recursive: getWithClause(statement)?.recursive ?? false
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

    // Prefer formatter-produced scalar bindings while still filling in original runtime params.
    for (const part of parts) {
      if (!isPlainObject(part)) {
        continue;
      }

      for (const [key, value] of Object.entries(part)) {
        if (value === null || value === undefined) {
          if (!(key in merged)) {
            merged[key] = value;
          }
          continue;
        }

        merged[key] = value;
      }
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  const runtimeArray = Array.isArray(runtimeParams) ? runtimeParams : [];
  const merged: unknown[] = [];

  for (const part of parts) {
    if (!Array.isArray(part)) {
      continue;
    }

    for (let index = 0; index < part.length; index += 1) {
      const value = part[index];
      merged.push(value === null || value === undefined ? runtimeArray[index] : value);
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

function extractScalarBinding(rows: PipelineRow[], target: string, ordinal: number): ScalarMaterialBinding {
  if (rows.length !== 1) {
    throw new Error(`Scalar material "${target}" must return exactly one row.`);
  }

  const row = rows[0];
  const columns = Object.keys(row);
  if (columns.length !== 1) {
    throw new Error(`Scalar material "${target}" must return exactly one column.`);
  }

  return {
    target,
    columnName: columns[0],
    value: row[columns[0]] as SqlParameterValue,
    paramName: `__scalar_${target}_${ordinal}`
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
