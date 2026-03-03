import { DeleteQuery, InsertQuery, ParenSource, SimpleSelectQuery, SourceExpression, SqlParser, SubQuerySource, UpdateQuery } from 'rawsql-ts';
import type { FromClause, JoinClause, ReturningClause, TableSource, UsingClause } from 'rawsql-ts';
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
  if (!target.table || context.inCte || context.inSubquery) {
    return [];
  }
  return [
    {
      usageKind: 'returning',
      searchTerms: buildTableSearchTerms(target, mode),
      confidence: mode === 'exact' ? 'medium' : 'low',
      notes: mode === 'exact' ? [] : ['relaxed-match-any-schema'],
      clauseAnchor: resolveClauseAnchor('returning'),
      strongClauseMatch: false
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
        }, mode),
        confidence: mode === 'exact' ? 'high' : 'low',
        notes: mode === 'exact' ? [] : ['relaxed-match-any-schema'],
        clauseAnchor: resolveClauseAnchor(usageKind),
        strongClauseMatch: mode === 'exact' && usageKind !== 'returning'
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
    clauseAnchor: occurrence.clauseAnchor
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
    case 'returning':
      return { kind: usageKind, tokens: ['RETURNING'] };
    default:
      return { kind: usageKind, tokens: ['FROM'] };
  }
}
