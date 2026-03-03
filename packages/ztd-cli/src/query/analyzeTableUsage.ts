import { DeleteQuery, InsertQuery, SimpleSelectQuery, SqlParser, UpdateQuery, SourceExpression } from 'rawsql-ts';
import type { FromClause, TableSource, JoinClause, ReturningClause, UsingClause } from 'rawsql-ts';
import { TableSource as TableSourceModel, SubQuerySource, ParenSource } from 'rawsql-ts';
import { locateUsageText } from './location';
import type { CatalogStatement } from '../utils/sqlCatalogStatements';
import type { QueryUsageAnalyzerResult, QueryUsageConfidence, QueryUsageMatch, QueryUsageMode, QueryUsageTarget, QueryUsageWarning } from './types';

interface TableOccurrence {
  usageKind: string;
  searchTerms: string[];
  confidence: QueryUsageConfidence;
  notes: string[];
}

/**
 * Analyze table usage for a single statement using AST-first traversal.
 */
export function analyzeTableUsage(params: {
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

  const occurrences = collectTableOccurrences(parsed, params.target, params.mode);
  return {
    matches: occurrences.map((occurrence) => toTableMatch(params.statement, occurrence)),
    warnings: []
  };
}

function collectTableOccurrences(
  parsed: unknown,
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
    if (parsed.fromClause) {
      matches.push(...collectFromClauseOccurrences(parsed.fromClause, target, mode, context));
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
    if (parsed.returningClause) {
      matches.push(...collectReturningOccurrences(parsed.returningClause, target, mode, context));
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
    if (parsed.returningClause) {
      matches.push(...collectReturningOccurrences(parsed.returningClause, target, mode, context));
    }
    return matches;
  }
  if (parsed instanceof InsertQuery) {
    const matches: TableOccurrence[] = [];
    matches.push(...collectSourceExpressionOccurrences(parsed.insertClause.source, target, mode, context, 'insert-target'));
    if (parsed.selectQuery) {
      matches.push(...collectTableOccurrences(parsed.selectQuery, target, mode, { inSubquery: true }));
    }
    if (parsed.returningClause) {
      matches.push(...collectReturningOccurrences(parsed.returningClause, target, mode, context));
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

function collectReturningOccurrences(
  _returningClause: ReturningClause,
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  context: { inSubquery?: boolean; inCte?: boolean }
): TableOccurrence[] {
  if (!target.table) {
    return [];
  }
  if (context.inCte || context.inSubquery) {
    return [];
  }
  return [
    {
      usageKind: 'returning',
      searchTerms: buildTableSearchTerms(target),
      confidence: mode === 'exact' ? 'medium' : 'low',
      notes: mode === 'exact' ? [] : ['relaxed-match-any-schema']
    }
  ];
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
        }),
        confidence: mode === 'exact' ? 'high' : 'low',
        notes: mode === 'exact' ? [] : ['relaxed-match-any-schema']
      }];
    }
    return [];
  }
  if (source.datasource instanceof SubQuerySource) {
    return collectTableOccurrences(source.datasource.query, target, mode, { ...context, inSubquery: true });
  }
  if (source.datasource instanceof ParenSource) {
    return collectNestedSourceOccurrences(source.datasource.source, source.aliasExpression, target, mode, context, usageKind);
  }
  return [];
}

function collectNestedSourceOccurrences(
  datasource: SourceExpression['datasource'],
  aliasExpression: SourceExpression['aliasExpression'],
  target: QueryUsageTarget,
  mode: QueryUsageMode,
  context: { inSubquery?: boolean; inCte?: boolean },
  usageKind: string
): TableOccurrence[] {
  return collectSourceExpressionOccurrences(
    new SourceExpression(datasource, aliasExpression),
    target,
    mode,
    context,
    usageKind
  );
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

function buildTableSearchTerms(target: QueryUsageTarget): string[] {
  const terms: string[] = [];
  if (target.schema && target.table) {
    terms.push(`${target.schema}.${target.table}`);
  }
  if (target.table) {
    terms.push(target.table);
  }
  return terms;
}

function toTableMatch(statement: CatalogStatement, occurrence: TableOccurrence): QueryUsageMatch {
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
    location: located.location,
    snippet: located.snippet,
    confidence: located.ambiguous ? 'low' : occurrence.confidence,
    notes: notes.sort(),
    source: 'ast'
  };
}
