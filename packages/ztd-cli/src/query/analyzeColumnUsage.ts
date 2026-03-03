import {
  ArrayExpression,
  ArrayIndexExpression,
  ArrayQueryExpression,
  ArraySliceExpression,
  BetweenExpression,
  BinaryExpression,
  CaseExpression,
  CaseKeyValuePair,
  CastExpression,
  ColumnReference,
  DeleteQuery,
  FunctionCall,
  IdentifierString,
  InlineQuery,
  InsertQuery,
  JoinOnClause,
  JoinUsingClause,
  OrderByItem,
  ParenExpression,
  RawString,
  SelectItem,
  SimpleSelectQuery,
  SqlParser,
  StringSpecifierExpression,
  SubQuerySource,
  SwitchCaseArgument,
  TableSource,
  TupleExpression,
  UnaryExpression,
  UpdateQuery,
  ValueList,
  type FromClause,
  type JoinClause,
  type SourceExpression,
  type ValueComponent
} from 'rawsql-ts';
import { ParenSource } from 'rawsql-ts';
import { locateUsageText } from './location';
import type { CatalogStatement } from '../utils/sqlCatalogStatements';
import type {
  QueryUsageAnalyzerResult,
  QueryUsageConfidence,
  QueryUsageMatch,
  QueryUsageMode,
  QueryUsageTarget,
  QueryUsageWarning
} from './types';

interface ScopeState {
  targetTablePresent: boolean;
  aliases: Set<string>;
}

interface ColumnOccurrence {
  usageKind: string;
  searchTerms: string[];
  confidence: QueryUsageConfidence;
  notes: string[];
  exprHints: string[];
}

/**
 * Analyze column usage for a single statement using AST traversal with explicit uncertainty labeling.
 */
export function analyzeColumnUsage(params: {
  statement: CatalogStatement;
  target: QueryUsageTarget;
  mode: QueryUsageMode;
}): QueryUsageAnalyzerResult {
  let parsed: unknown;
  try {
    parsed = SqlParser.parse(params.statement.statementText);
  } catch (error) {
    return {
      matches: [],
      warnings: [
        {
          catalog_id: params.statement.catalogId,
          query_id: params.statement.queryId,
          sql_file: params.statement.sqlFile,
          code: 'parse-failed',
          message: error instanceof Error ? error.message : String(error)
        }
      ]
    };
  }

  const occurrences = collectColumnOccurrences(parsed, params.target, params.mode);
  return {
    matches: occurrences.map((occurrence) => toColumnMatch(params.statement, occurrence)),
    warnings: []
  };
}

function collectColumnOccurrences(
  parsed: unknown,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  context: { inSubquery?: boolean; inCte?: boolean } = {}
): ColumnOccurrence[] {
  if (parsed instanceof SimpleSelectQuery) {
    const matches: ColumnOccurrence[] = [];
    if (parsed.withClause) {
      for (const table of parsed.withClause.tables) {
        matches.push(...collectColumnOccurrences(table.query, target, mode, { inCte: true }));
      }
    }
    const scope = buildScope(parsed.fromClause ?? undefined, target, mode);
    if (parsed.fromClause) {
      matches.push(...collectNestedSourceQueryMatches(parsed.fromClause.source, target, mode));
    }
    for (const item of parsed.selectClause.items) {
      matches.push(...collectSelectItemMatches(item, target, mode, scope, context));
    }
    if (parsed.whereClause) {
      matches.push(...collectExpressionMatches(parsed.whereClause.condition, target, mode, scope, context, 'where', []));
    }
    if (parsed.groupByClause) {
      for (const group of parsed.groupByClause.grouping) {
        matches.push(...collectExpressionMatches(group, target, mode, scope, context, 'group-by', []));
      }
    }
    if (parsed.havingClause) {
      matches.push(...collectExpressionMatches(parsed.havingClause.condition, target, mode, scope, context, 'having', []));
    }
    if (parsed.orderByClause) {
      for (const order of parsed.orderByClause.order) {
        if (order instanceof OrderByItem) {
          matches.push(...collectExpressionMatches(order.value, target, mode, scope, context, 'order-by', []));
        } else {
          matches.push(...collectExpressionMatches(order, target, mode, scope, context, 'order-by', []));
        }
      }
    }
    if (parsed.fromClause?.joins) {
      for (const join of parsed.fromClause.joins) {
        matches.push(...collectNestedSourceQueryMatches(join.source, target, mode));
        matches.push(...collectJoinMatches(join, target, mode, scope, context));
      }
    }
    return matches;
  }
  if (parsed instanceof UpdateQuery) {
    const matches: ColumnOccurrence[] = [];
    if (parsed.withClause) {
      for (const table of parsed.withClause.tables) {
        matches.push(...collectColumnOccurrences(table.query, target, mode, { inCte: true }));
      }
    }
    const scope = buildScope(parsed.fromClause ?? undefined, target, mode, parsed.updateClause.source);
    for (const item of parsed.setClause.items) {
      if (matchesColumnName(item.column.name, target)) {
        matches.push(buildExplicitOccurrence(item.column.name, target, mode, 'update-set', [], scope, context));
      }
      matches.push(...collectExpressionMatches(item.value, target, mode, scope, context, 'update-set', []));
    }
    if (parsed.whereClause) {
      matches.push(...collectExpressionMatches(parsed.whereClause.condition, target, mode, scope, context, 'where', []));
    }
    if (parsed.returningClause) {
      for (const item of parsed.returningClause.items) {
        matches.push(...collectSelectItemMatches(item, target, mode, scope, context, 'returning'));
      }
    }
    if (parsed.fromClause?.joins) {
      for (const join of parsed.fromClause.joins) {
        matches.push(...collectJoinMatches(join, target, mode, scope, context));
      }
    }
    return matches;
  }
  if (parsed instanceof DeleteQuery) {
    const matches: ColumnOccurrence[] = [];
    if (parsed.withClause) {
      for (const table of parsed.withClause.tables) {
        matches.push(...collectColumnOccurrences(table.query, target, mode, { inCte: true }));
      }
    }
    const scope = buildScope(undefined, target, mode, parsed.deleteClause.source);
    if (parsed.whereClause) {
      matches.push(...collectExpressionMatches(parsed.whereClause.condition, target, mode, scope, context, 'where', []));
    }
    if (parsed.returningClause) {
      for (const item of parsed.returningClause.items) {
        matches.push(...collectSelectItemMatches(item, target, mode, scope, context, 'returning'));
      }
    }
    return matches;
  }
  if (parsed instanceof InsertQuery) {
    const scope = buildScope(undefined, target, mode, parsed.insertClause.source);
    const matches: ColumnOccurrence[] = [];
    if (parsed.insertClause.columns) {
      for (const column of parsed.insertClause.columns) {
        if (matchesColumnName(column.name, target)) {
          matches.push(buildExplicitOccurrence(column.name, target, mode, 'insert-column', [], scope, context));
        }
      }
    }
    if (parsed.selectQuery) {
      matches.push(...collectColumnOccurrences(parsed.selectQuery, target, mode, { inSubquery: true }));
    }
    if (parsed.returningClause) {
      for (const item of parsed.returningClause.items) {
        matches.push(...collectSelectItemMatches(item, target, mode, scope, context, 'returning'));
      }
    }
    return matches;
  }
  return [];
}

function buildScope(
  fromClause: FromClause | undefined,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  primarySource?: SourceExpression
): ScopeState {
  const scope: ScopeState = {
    targetTablePresent: mode === 'any-schema-any-table',
    aliases: new Set<string>()
  };
  if (primarySource) {
    collectScopeFromSource(primarySource, target, mode, scope);
  }
  if (fromClause) {
    collectScopeFromSource(fromClause.source, target, mode, scope);
    if (fromClause.joins) {
      for (const join of fromClause.joins) {
        collectScopeFromSource(join.source, target, mode, scope);
      }
    }
  }
  return scope;
}

function collectScopeFromSource(source: SourceExpression, target: QueryUsageTarget, mode: QueryUsageMode, scope: ScopeState): void {
  if (!(source.datasource instanceof TableSource)) {
    return;
  }
  const schema = source.datasource.namespaces?.map((value) => value.name).join('.') || undefined;
  const table = source.datasource.table.name;
  const matches =
    mode === 'exact'
      ? target.schema !== undefined && target.table !== undefined && `${schema}.${table}`.toLowerCase() === `${target.schema}.${target.table}`.toLowerCase()
      : mode === 'any-schema'
        ? target.table !== undefined && table.toLowerCase() === target.table.toLowerCase()
        : true;
  if (!matches) {
    return;
  }

  scope.targetTablePresent = true;
  if (source.aliasExpression) {
    scope.aliases.add(source.aliasExpression.table.name.toLowerCase());
  }
  scope.aliases.add(table.toLowerCase());
  if (schema) {
    scope.aliases.add(`${schema}.${table}`.toLowerCase());
  }
}

function collectSelectItemMatches(
  item: SelectItem,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  scope: ScopeState,
  context: { inSubquery?: boolean; inCte?: boolean },
  rootUsageKind = 'select'
): ColumnOccurrence[] {
  return collectExpressionMatches(item.value, target, mode, scope, context, rootUsageKind, ['projection']);
}

function collectJoinMatches(
  join: JoinClause,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  scope: ScopeState,
  context: { inSubquery?: boolean; inCte?: boolean }
): ColumnOccurrence[] {
  if (!join.condition) {
    return [];
  }
  if (join.condition instanceof JoinOnClause) {
    return collectExpressionMatches(join.condition.condition, target, mode, scope, context, 'join-on', []);
  }
  if (join.condition instanceof JoinUsingClause) {
    return collectExpressionMatches(join.condition.condition, target, mode, scope, context, 'join-using', []);
  }
  return [];
}

function collectNestedSourceQueryMatches(
  source: SourceExpression,
  target: QueryUsageTarget,
  mode: QueryUsageMode
): ColumnOccurrence[] {
  if (source.datasource instanceof SubQuerySource) {
    return collectColumnOccurrences(source.datasource.query, target, mode, { inSubquery: true });
  }
  if (source.datasource instanceof ParenSource) {
    const nested = source.datasource.source;
    if (nested instanceof SubQuerySource) {
      return collectColumnOccurrences(nested.query, target, mode, { inSubquery: true });
    }
  }
  return [];
}

function collectExpressionMatches(
  value: ValueComponent,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  scope: ScopeState,
  context: { inSubquery?: boolean; inCte?: boolean },
  rootUsageKind: string,
  exprHints: string[]
): ColumnOccurrence[] {
  if (value instanceof ColumnReference) {
    return collectColumnReferenceMatch(value, target, mode, scope, context, rootUsageKind, exprHints);
  }
  if (value instanceof BinaryExpression) {
    return [
      ...collectExpressionMatches(value.left, target, mode, scope, context, rootUsageKind, [...exprHints, 'comparison']),
      ...collectExpressionMatches(value.right, target, mode, scope, context, rootUsageKind, [...exprHints, 'comparison'])
    ];
  }
  if (value instanceof UnaryExpression) {
    return collectExpressionMatches(value.expression, target, mode, scope, context, rootUsageKind, exprHints);
  }
  if (value instanceof FunctionCall) {
    const nestedHints = [...exprHints, 'function'];
    const functionName = value.name instanceof IdentifierString ? value.name.name : value.name.value;
    if (['count', 'sum', 'avg', 'min', 'max'].includes(functionName.toLowerCase())) {
      nestedHints.push('aggregate');
    }
    const matches: ColumnOccurrence[] = [];
    if (value.argument) {
      matches.push(...collectExpressionMatches(value.argument, target, mode, scope, context, rootUsageKind, nestedHints));
    }
    if (value.filterCondition) {
      matches.push(...collectExpressionMatches(value.filterCondition, target, mode, scope, context, rootUsageKind, nestedHints));
    }
    if (value.internalOrderBy) {
      for (const order of value.internalOrderBy.order) {
        matches.push(...collectExpressionMatches(order instanceof OrderByItem ? order.value : order, target, mode, scope, context, rootUsageKind, nestedHints));
      }
    }
    return matches;
  }
  if (value instanceof CastExpression) {
    return collectExpressionMatches(value.input, target, mode, scope, context, rootUsageKind, [...exprHints, 'cast']);
  }
  if (value instanceof ParenExpression) {
    return collectExpressionMatches(value.expression, target, mode, scope, context, rootUsageKind, exprHints);
  }
  if (value instanceof InlineQuery) {
    return collectColumnOccurrences(value.selectQuery, target, mode, { inSubquery: true });
  }
  if (value instanceof ArrayQueryExpression) {
    return collectColumnOccurrences(value.query, target, mode, { inSubquery: true });
  }
  if (value instanceof ArrayExpression) {
    return collectExpressionMatches(value.expression, target, mode, scope, context, rootUsageKind, exprHints);
  }
  if (value instanceof ArraySliceExpression) {
    return [
      ...collectExpressionMatches(value.array, target, mode, scope, context, rootUsageKind, exprHints),
      ...(value.startIndex ? collectExpressionMatches(value.startIndex, target, mode, scope, context, rootUsageKind, exprHints) : []),
      ...(value.endIndex ? collectExpressionMatches(value.endIndex, target, mode, scope, context, rootUsageKind, exprHints) : [])
    ];
  }
  if (value instanceof ArrayIndexExpression) {
    return [
      ...collectExpressionMatches(value.array, target, mode, scope, context, rootUsageKind, exprHints),
      ...collectExpressionMatches(value.index, target, mode, scope, context, rootUsageKind, exprHints)
    ];
  }
  if (value instanceof ValueList) {
    return value.values.flatMap((entry) => collectExpressionMatches(entry, target, mode, scope, context, rootUsageKind, exprHints));
  }
  if (value instanceof BetweenExpression) {
    return [
      ...collectExpressionMatches(value.expression, target, mode, scope, context, rootUsageKind, [...exprHints, 'comparison']),
      ...collectExpressionMatches(value.lower, target, mode, scope, context, rootUsageKind, [...exprHints, 'comparison']),
      ...collectExpressionMatches(value.upper, target, mode, scope, context, rootUsageKind, [...exprHints, 'comparison'])
    ];
  }
  if (value instanceof CaseExpression) {
    return [
      ...(value.condition ? collectExpressionMatches(value.condition, target, mode, scope, context, rootUsageKind, exprHints) : []),
      ...collectExpressionMatches(value.switchCase, target, mode, scope, context, rootUsageKind, exprHints)
    ];
  }
  if (value instanceof SwitchCaseArgument) {
    return [
      ...value.cases.flatMap((item) => collectExpressionMatches(item, target, mode, scope, context, rootUsageKind, exprHints)),
      ...(value.elseValue ? collectExpressionMatches(value.elseValue, target, mode, scope, context, rootUsageKind, exprHints) : [])
    ];
  }
  if (value instanceof CaseKeyValuePair) {
    return [
      ...collectExpressionMatches(value.key, target, mode, scope, context, rootUsageKind, exprHints),
      ...collectExpressionMatches(value.value, target, mode, scope, context, rootUsageKind, exprHints)
    ];
  }
  if (value instanceof TupleExpression) {
    return value.values.flatMap((entry) => collectExpressionMatches(entry, target, mode, scope, context, rootUsageKind, exprHints));
  }
  if (value instanceof StringSpecifierExpression || value instanceof IdentifierString || value instanceof RawString) {
    return [];
  }
  return [];
}

function collectColumnReferenceMatch(
  value: ColumnReference,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  scope: ScopeState,
  context: { inSubquery?: boolean; inCte?: boolean },
  rootUsageKind: string,
  exprHints: string[]
): ColumnOccurrence[] {
  const usageKind = context.inCte ? 'cte' : context.inSubquery ? 'subquery' : rootUsageKind;
  const notes = new Set<string>();
  const hints = new Set(exprHints);
  let confidence: QueryUsageConfidence = mode === 'exact' ? 'high' : 'low';
  let searchTerms: string[] = [];

  const namespace = value.namespaces?.map((entry) => entry.name).join('.').toLowerCase();
  const columnName = value.column.name;
  const wildcard = columnName === '*';

  if (wildcard) {
    hints.add('wildcard');
    notes.add('wildcard-select');
    confidence = 'low';
    if (!scope.targetTablePresent) {
      return [];
    }
    const qualifier = namespace ? `${namespace}.*` : '*';
    searchTerms = [qualifier];
  } else {
    if (!matchesColumnName(columnName, target)) {
      return [];
    }

    if (usageKind === 'join-using') {
      notes.add('join-using-column');
      confidence = 'low';
    }
    if (!namespace) {
      notes.add('unqualified-column');
      confidence = 'low';
      if (!scope.targetTablePresent && mode !== 'any-schema-any-table') {
        return [];
      }
      searchTerms = [columnName];
    } else {
      const matchesNamespace =
        mode === 'any-schema-any-table'
          ? true
          : scope.aliases.has(namespace) ||
            (target.table ? namespace === target.table.toLowerCase() : false) ||
            (target.schema && target.table ? namespace === `${target.schema}.${target.table}`.toLowerCase() : false);
      if (!matchesNamespace) {
        return [];
      }
      searchTerms = [`${namespace}.${columnName}`];
    }
  }

  if (context.inSubquery && rootUsageKind === 'select') {
    notes.add('subquery-projection');
  }
  if (context.inCte && rootUsageKind === 'select') {
    notes.add('cte-projection');
  }
  if (mode !== 'exact') {
    notes.add('relaxed-match-any-schema');
    if (mode === 'any-schema-any-table') {
      notes.add('relaxed-match-any-table');
    }
    confidence = 'low';
  }

  return [{
    usageKind,
    searchTerms,
    confidence,
    notes: Array.from(notes),
    exprHints: Array.from(hints)
  }];
}

function buildExplicitOccurrence(
  columnName: string,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  usageKind: string,
  exprHints: string[],
  scope: ScopeState,
  context: { inSubquery?: boolean; inCte?: boolean }
): ColumnOccurrence {
  const notes = new Set<string>();
  if (!scope.targetTablePresent && mode !== 'any-schema-any-table') {
    notes.add('unqualified-column');
  }
  if (mode !== 'exact') {
    notes.add('relaxed-match-any-schema');
    if (mode === 'any-schema-any-table') {
      notes.add('relaxed-match-any-table');
    }
  }
  return {
    usageKind: context.inCte ? 'cte' : context.inSubquery ? 'subquery' : usageKind,
    searchTerms: [columnName],
    confidence: notes.size > 0 ? 'low' : 'high',
    notes: Array.from(notes),
    exprHints
  };
}

function matchesColumnName(columnName: string, target: QueryUsageTarget): boolean {
  return target.column !== undefined && columnName.toLowerCase() === target.column.toLowerCase();
}

function toColumnMatch(statement: CatalogStatement, occurrence: ColumnOccurrence): QueryUsageMatch {
  const located = locateUsageText({
    statementText: statement.statementText,
    statementStartOffsetInFile: statement.statementStartOffsetInFile,
    candidates: occurrence.searchTerms
  });
  const notes = [...occurrence.notes];
  if (located.ambiguous && !notes.includes('ambiguous-multiple-occurrences')) {
    notes.push('ambiguous-multiple-occurrences');
  }
  return {
    catalog_id: statement.catalogId,
    query_id: statement.queryId,
    statement_fingerprint: statement.statementFingerprint,
    sql_file: statement.sqlFile,
    usage_kind: occurrence.usageKind,
    exprHints: occurrence.exprHints.length > 0 ? occurrence.exprHints.sort() : undefined,
    location: located.location,
    snippet: located.snippet,
    confidence: located.ambiguous ? 'low' : occurrence.confidence,
    notes: notes.sort(),
    source: 'ast'
  };
}
