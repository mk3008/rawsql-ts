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
  WithClause
} from 'rawsql-ts';
import {
  analyzeStatement,
  assertSupportedStatement,
  collectDependencyClosure,
  collectReachableCtes,
  type SupportedStatement
} from './analysis';

export interface QuerySliceOptions {
  cte?: string;
  final?: boolean;
  limit?: number;
}

export interface QuerySliceReport {
  file: string;
  mode: 'cte' | 'final';
  target: string;
  included_ctes: string[];
  sql: string;
}

/**
 * Build a minimal executable SQL slice for either a target CTE or the final query.
 */
export function buildQuerySliceReport(sqlFile: string, options: QuerySliceOptions): QuerySliceReport {
  validateSliceOptions(options);

  const absolutePath = path.resolve(sqlFile);
  const sql = readFileSync(absolutePath, 'utf8');
  const statement = assertSupportedStatement(SqlParser.parse(sql), 'ztd query slice');
  const analysis = analyzeStatement(statement);

  if (analysis.ctes.length === 0) {
    throw new Error('ztd query slice requires a query with at least one CTE.');
  }

  if (options.cte) {
    return buildTargetSliceReport(absolutePath, statement, analysis.ctes, analysis.dependencyMap, options.cte, options.limit);
  }

  return buildFinalSliceReport(absolutePath, sql, options.limit);
}

function buildTargetSliceReport(
  absolutePath: string,
  statement: SupportedStatement,
  ctes: CommonTable[],
  dependencyMap: Map<string, string[]>,
  targetName: string,
  limit: number | undefined
): QuerySliceReport {
  const includedNames = collectDependencyClosure(targetName, dependencyMap);
  if (!includedNames.includes(targetName)) {
    throw new Error(`CTE not found in query: ${targetName}`);
  }

  const includedCtes = filterCtesByOrder(ctes, includedNames);
  if (!includedCtes.some((cte) => cte.aliasExpression.table.name === targetName)) {
    throw new Error(`CTE not found in query: ${targetName}`);
  }

  const formatter = new SqlFormatter();
  const sliceQuery = buildSelectFromTargetQuery(targetName, limit);
  const sql = composeSliceSql(
    getWithClause(statement)?.recursive ?? false,
    includedCtes,
    formatter.format(sliceQuery).formattedSql,
    formatter
  );

  return {
    file: absolutePath,
    mode: 'cte',
    target: targetName,
    included_ctes: includedCtes.map((cte) => cte.aliasExpression.table.name),
    sql: `${sql}\n`
  };
}

function buildFinalSliceReport(
  absolutePath: string,
  sql: string,
  limit: number | undefined
): QuerySliceReport {
  const parsed = assertSupportedStatement(SqlParser.parse(sql), 'ztd query slice');
  const analysis = analyzeStatement(parsed);
  const includedSet = collectReachableCtes(analysis.rootDependencies, analysis.dependencyMap);
  const includedCtes = filterCtesByOrder(analysis.ctes, [...includedSet]);

  // Retain only the transitive closure needed by the final statement.
  applyMinimalWithClause(parsed, includedCtes);

  // Preserve the original final statement and only inject a LIMIT when the final statement is SELECT-compatible.
  if (limit !== undefined) {
    if (parsed instanceof SimpleSelectQuery) {
      parsed.limitClause = new LimitClause(new LiteralValue(limit));
    } else if (parsed instanceof ValuesQuery || parsed instanceof BinarySelectQuery) {
      const formatter = new SqlFormatter();
      const wrapped = buildWrappedLimitQuery(parsed, limit);
      return {
        file: absolutePath,
        mode: 'final',
        target: 'FINAL_QUERY',
        included_ctes: includedCtes.map((cte) => cte.aliasExpression.table.name),
        sql: `${formatter.format(wrapped).formattedSql}\n`
      };
    } else {
      throw new Error('--limit is only supported for SELECT final slices or --cte slices.');
    }
  }

  const formatter = new SqlFormatter();
  return {
    file: absolutePath,
    mode: 'final',
    target: 'FINAL_QUERY',
    included_ctes: includedCtes.map((cte) => cte.aliasExpression.table.name),
    sql: `${formatter.format(parsed).formattedSql}\n`
  };
}

function validateSliceOptions(options: QuerySliceOptions): void {
  const hasTarget = typeof options.cte === 'string' && options.cte.trim() !== '';
  const hasFinal = options.final === true;

  if (hasTarget === hasFinal) {
    throw new Error('Specify exactly one of --cte <name> or --final.');
  }
}

function filterCtesByOrder(ctes: CommonTable[], includedNames: string[]): CommonTable[] {
  const includedSet = new Set(includedNames);
  return ctes.filter((cte) => includedSet.has(cte.aliasExpression.table.name));
}

function composeSliceSql(recursive: boolean, ctes: CommonTable[], mainQuery: string, formatter: SqlFormatter): string {
  if (ctes.length === 0) {
    return mainQuery;
  }

  // Format the WithClause directly so CommonTable metadata such as materialization hints
  // and alias column lists survive the slice output intact.
  const withClause = formatter.format(new WithClause(recursive, ctes)).formattedSql;
  return `${withClause} ${mainQuery}`;
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

function applyMinimalWithClause(statement: SupportedStatement, ctes: CommonTable[]): void {
  const existingWithClause = getWithClause(statement);
  const nextWithClause = ctes.length > 0 ? new WithClause(existingWithClause?.recursive ?? false, ctes) : null;

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

  throw new Error('Unable to apply sliced WITH clause to the final query.');
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

  throw new Error('Expected a SELECT-compatible statement for query slicing.');
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
