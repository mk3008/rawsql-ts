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
  DeleteQuery,
  FunctionCall,
  IdentifierString,
  InlineQuery,
  InsertQuery,
  OrderByItem,
  ParenExpression,
  ParenSource,
  RawString,
  SelectQuery,
  SimpleSelectQuery,
  SourceExpression,
  SqlParser,
  StringSpecifierExpression,
  SubQuerySource,
  SwitchCaseArgument,
  TupleExpression,
  UnaryExpression,
  UpdateQuery,
  ValueList,
  type ParsedStatement,
  type ValueComponent
} from 'rawsql-ts';
import type { FromClause, JoinClause, TableSource, UsingClause } from 'rawsql-ts';
import { TableSource as TableSourceModel } from 'rawsql-ts';
import { locateUsageText } from './location';
import type { CatalogStatement } from '../utils/sqlCatalogStatements';
import type {
  QueryUsageAnalyzerResult,
  QueryUsageClauseAnchor,
  QueryUsageConfidence,
  QueryUsageMatchDetail,
  QueryUsageMode,
  QueryUsageTarget
} from './types';

interface TableOccurrence {
  usageKind: string;
  searchTerms: string[];
  confidence: QueryUsageConfidence;
  notes: string[];
  clauseAnchor: QueryUsageClauseAnchor;
  strongClauseMatch: boolean;
}

/**
 * Analyze table usage for a single statement using AST-first traversal.
 */
export function analyzeTableUsage(params: {
  statement: CatalogStatement;
  target: QueryUsageTarget;
  mode: QueryUsageMode;
}): QueryUsageAnalyzerResult {
  try {
    const parsed = SqlParser.parse(params.statement.statementText);
    const occurrences = collectTableOccurrences(parsed, params.target, params.mode);
    return {
      matches: occurrences.map((occurrence) => toTableMatch(params.statement, occurrence)),
      warnings: []
    };
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
}

function collectTableOccurrences(
  parsed: ParsedStatement | SelectQuery,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  context: { inSubquery?: boolean; inCte?: boolean } = {}
): TableOccurrence[] {
  if (parsed instanceof SimpleSelectQuery) {
    const matches: TableOccurrence[] = [];
    if (parsed.withClause) {
      for (const table of parsed.withClause.tables) {
        matches.push(...collectTableOccurrences(table.query, target, mode, { inCte: true }));
      }
    }
    for (const item of parsed.selectClause.items) {
      matches.push(...collectExpressionQueryOccurrences(item.value, target, mode, context));
    }
    if (parsed.fromClause) {
      matches.push(...collectFromClauseOccurrences(parsed.fromClause, target, mode, context));
    }
    if (parsed.whereClause) {
      matches.push(...collectExpressionQueryOccurrences(parsed.whereClause.condition, target, mode, context));
    }
    if (parsed.havingClause) {
      matches.push(...collectExpressionQueryOccurrences(parsed.havingClause.condition, target, mode, context));
    }
    if (parsed.groupByClause) {
      for (const group of parsed.groupByClause.grouping) {
        matches.push(...collectExpressionQueryOccurrences(group, target, mode, context));
      }
    }
    if (parsed.orderByClause) {
      for (const order of parsed.orderByClause.order) {
        matches.push(...collectExpressionQueryOccurrences(order instanceof OrderByItem ? order.value : order, target, mode, context));
      }
    }
    return matches;
  }
  if (parsed instanceof UpdateQuery) {
    const matches: TableOccurrence[] = [];
    if (parsed.withClause) {
      for (const table of parsed.withClause.tables) {
        matches.push(...collectTableOccurrences(table.query, target, mode, { inCte: true }));
      }
    }
    matches.push(...collectSourceExpressionOccurrences(parsed.updateClause.source, target, mode, context, 'update-target'));
    if (parsed.fromClause) {
      matches.push(...collectFromClauseOccurrences(parsed.fromClause, target, mode, context));
    }
    if (parsed.whereClause) {
      matches.push(...collectExpressionQueryOccurrences(parsed.whereClause.condition, target, mode, context));
    }
    for (const item of parsed.setClause.items) {
      matches.push(...collectExpressionQueryOccurrences(item.value, target, mode, context));
    }
    return matches;
  }
  if (parsed instanceof DeleteQuery) {
    const matches: TableOccurrence[] = [];
    if (parsed.withClause) {
      for (const table of parsed.withClause.tables) {
        matches.push(...collectTableOccurrences(table.query, target, mode, { inCte: true }));
      }
    }
    matches.push(...collectSourceExpressionOccurrences(parsed.deleteClause.source, target, mode, context, 'delete-target'));
    if (parsed.usingClause) {
      matches.push(...collectUsingOccurrences(parsed.usingClause, target, mode, context));
    }
    if (parsed.whereClause) {
      matches.push(...collectExpressionQueryOccurrences(parsed.whereClause.condition, target, mode, context));
    }
    return matches;
  }
  if (parsed instanceof InsertQuery) {
    const matches: TableOccurrence[] = [];
    matches.push(...collectSourceExpressionOccurrences(parsed.insertClause.source, target, mode, context, 'insert-target'));
    if (parsed.selectQuery) {
      matches.push(...collectTableOccurrences(parsed.selectQuery, target, mode, { inSubquery: true }));
    }
    return matches;
  }
  return [];
}

function collectFromClauseOccurrences(
  fromClause: FromClause,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  context: { inSubquery?: boolean; inCte?: boolean }
): TableOccurrence[] {
  const usageKind = context.inCte ? 'cte-body-from' : context.inSubquery ? 'subquery-from' : 'from';
  const matches = collectSourceExpressionOccurrences(fromClause.source, target, mode, context, usageKind);
  if (fromClause.joins) {
    for (const join of fromClause.joins) {
      matches.push(...collectJoinOccurrences(join, target, mode, context));
    }
  }
  return matches;
}

function collectJoinOccurrences(
  join: JoinClause,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  context: { inSubquery?: boolean; inCte?: boolean }
): TableOccurrence[] {
  const usageKind = context.inCte ? 'cte-body-from' : context.inSubquery ? 'subquery-from' : 'join';
  return collectSourceExpressionOccurrences(join.source, target, mode, context, usageKind);
}

function collectUsingOccurrences(
  usingClause: UsingClause,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  context: { inSubquery?: boolean; inCte?: boolean }
): TableOccurrence[] {
  return usingClause.getSources().flatMap((source) =>
    collectSourceExpressionOccurrences(source, target, mode, context, 'using')
  );
}

function collectExpressionQueryOccurrences(
  value: ValueComponent,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  context: { inSubquery?: boolean; inCte?: boolean }
): TableOccurrence[] {
  if (value instanceof InlineQuery) {
    return collectTableOccurrences(value.selectQuery, target, mode, { ...context, inSubquery: true });
  }
  if (value instanceof ArrayQueryExpression) {
    return collectTableOccurrences(value.query, target, mode, { ...context, inSubquery: true });
  }
  if (value instanceof BinaryExpression) {
    return [
      ...collectExpressionQueryOccurrences(value.left, target, mode, context),
      ...collectExpressionQueryOccurrences(value.right, target, mode, context)
    ];
  }
  if (value instanceof UnaryExpression) {
    return collectExpressionQueryOccurrences(value.expression, target, mode, context);
  }
  if (value instanceof FunctionCall) {
    const matches: TableOccurrence[] = [];
    if (value.argument) {
      matches.push(...collectExpressionQueryOccurrences(value.argument, target, mode, context));
    }
    if (value.filterCondition) {
      matches.push(...collectExpressionQueryOccurrences(value.filterCondition, target, mode, context));
    }
    if (value.internalOrderBy) {
      for (const order of value.internalOrderBy.order) {
        matches.push(...collectExpressionQueryOccurrences(order instanceof OrderByItem ? order.value : order, target, mode, context));
      }
    }
    return matches;
  }
  if (value instanceof CastExpression) {
    return collectExpressionQueryOccurrences(value.input, target, mode, context);
  }
  if (value instanceof ParenExpression) {
    return collectExpressionQueryOccurrences(value.expression, target, mode, context);
  }
  if (value instanceof ArrayExpression) {
    return collectExpressionQueryOccurrences(value.expression, target, mode, context);
  }
  if (value instanceof ArraySliceExpression) {
    return [
      ...collectExpressionQueryOccurrences(value.array, target, mode, context),
      ...(value.startIndex ? collectExpressionQueryOccurrences(value.startIndex, target, mode, context) : []),
      ...(value.endIndex ? collectExpressionQueryOccurrences(value.endIndex, target, mode, context) : [])
    ];
  }
  if (value instanceof ArrayIndexExpression) {
    return [
      ...collectExpressionQueryOccurrences(value.array, target, mode, context),
      ...collectExpressionQueryOccurrences(value.index, target, mode, context)
    ];
  }
  if (value instanceof ValueList) {
    return value.values.flatMap((entry) => collectExpressionQueryOccurrences(entry, target, mode, context));
  }
  if (value instanceof BetweenExpression) {
    return [
      ...collectExpressionQueryOccurrences(value.expression, target, mode, context),
      ...collectExpressionQueryOccurrences(value.lower, target, mode, context),
      ...collectExpressionQueryOccurrences(value.upper, target, mode, context)
    ];
  }
  if (value instanceof CaseExpression) {
    return [
      ...(value.condition ? collectExpressionQueryOccurrences(value.condition, target, mode, context) : []),
      ...collectExpressionQueryOccurrences(value.switchCase, target, mode, context)
    ];
  }
  if (value instanceof SwitchCaseArgument) {
    return [
      ...value.cases.flatMap((item) => collectExpressionQueryOccurrences(item, target, mode, context)),
      ...(value.elseValue ? collectExpressionQueryOccurrences(value.elseValue, target, mode, context) : [])
    ];
  }
  if (value instanceof CaseKeyValuePair) {
    return [
      ...collectExpressionQueryOccurrences(value.key, target, mode, context),
      ...collectExpressionQueryOccurrences(value.value, target, mode, context)
    ];
  }
  if (value instanceof TupleExpression) {
    return value.values.flatMap((entry) => collectExpressionQueryOccurrences(entry, target, mode, context));
  }
  if (value instanceof StringSpecifierExpression || value instanceof IdentifierString || value instanceof RawString) {
    return [];
  }
  return [];
}

function collectSourceExpressionOccurrences(
  source: SourceExpression,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  context: { inSubquery?: boolean; inCte?: boolean },
  usageKind: string
): TableOccurrence[] {
  if (source.datasource instanceof TableSourceModel) {
    const qualified = getQualifiedTable(source.datasource);
    if (matchesTargetTable(qualified, target, mode)) {
      return [{
        usageKind,
        searchTerms: buildTableSearchTerms({
          ...target,
          table: qualified.table,
          schema: qualified.schema
        }, mode),
        confidence: mode === 'exact' ? 'high' : 'low',
        notes: mode === 'exact' ? [] : ['relaxed-match-any-schema'],
        clauseAnchor: resolveClauseAnchor(usageKind),
        strongClauseMatch: mode === 'exact'
      }];
    }
    return [];
  }
  if (source.datasource instanceof SubQuerySource) {
    return collectTableOccurrences(source.datasource.query, target, mode, { ...context, inSubquery: true });
  }
  if (source.datasource instanceof ParenSource) {
    return collectSourceExpressionOccurrences(new SourceExpression(source.datasource.source, source.aliasExpression), target, mode, context, usageKind);
  }
  return [];
}

function getQualifiedTable(source: TableSource): { schema?: string; table: string; full: string } {
  const schema = source.namespaces?.map((value) => value.name).join('.') || undefined;
  const table = source.table.name;
  return {
    schema,
    table,
    full: schema ? `${schema}.${table}` : table
  };
}

function matchesTargetTable(
  table: { schema?: string; table: string; full: string },
  target: QueryUsageTarget,
  mode: QueryUsageMode
): boolean {
  if (mode === 'exact') {
    return target.schema !== undefined && target.table !== undefined && table.full.toLowerCase() === `${target.schema}.${target.table}`.toLowerCase();
  }
  return target.table !== undefined && table.table.toLowerCase() === target.table.toLowerCase();
}

function buildTableSearchTerms(target: QueryUsageTarget, mode: QueryUsageMode): string[] {
  if (mode === 'exact') {
    return target.schema && target.table ? [`${target.schema}.${target.table}`] : [];
  }
  if (mode === 'any-schema') {
    return target.table ? [target.table] : [];
  }
  return target.table ? [target.table] : [];
}

function toTableMatch(statement: CatalogStatement, occurrence: TableOccurrence): QueryUsageMatchDetail {
  const located = locateUsageText({
    statementText: statement.statementText,
    statementStartOffsetInFile: statement.statementStartOffsetInFile,
    candidates: occurrence.searchTerms,
    clauseAnchor: occurrence.clauseAnchor,
    snippetMode: 'line'
  });
  const notes = [...occurrence.notes];
  let confidence = occurrence.confidence;

  if (located.ambiguous && !notes.includes('ambiguous-multiple-occurrences')) {
    notes.push('ambiguous-multiple-occurrences');
    confidence = 'low';
  }
  if (occurrence.strongClauseMatch && !located.ambiguous) {
    confidence = 'high';
  }

  return {
    kind: 'detail',
    catalog_id: statement.catalogId,
    query_id: statement.queryId,
    statement_fingerprint: statement.statementFingerprint,
    sql_file: statement.sqlFile,
    usage_kind: occurrence.usageKind,
    location: located.location,
    snippet: located.snippet,
    confidence,
    notes: notes.sort(),
    source: 'ast'
  };
}

function resolveClauseAnchor(usageKind: string): QueryUsageClauseAnchor {
  switch (usageKind) {
    case 'from':
    case 'subquery-from':
    case 'cte-body-from':
      return { kind: usageKind, tokens: ['FROM'] };
    case 'join':
      return { kind: usageKind, tokens: ['JOIN'] };
    case 'insert-target':
      return { kind: usageKind, tokens: ['INSERT', 'INTO'] };
    case 'update-target':
      return { kind: usageKind, tokens: ['UPDATE'] };
    case 'delete-target':
      return { kind: usageKind, tokens: ['DELETE', 'FROM'] };
    case 'using':
      return { kind: usageKind, tokens: ['USING'] };
    default:
      return { kind: usageKind, tokens: ['FROM'] };
  }
}
