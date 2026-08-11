import { ColumnReference, InlineQuery } from 'rawsql-ts';
import type { LineageColumnRef, LineageUnresolvedColumnReference } from '../../domain/lineage';
import type { SourceReferenceTarget } from './sourceReferences.types';

export interface ResolveColumnReferencesOptions {
  formatExpressionSql?: (value: unknown) => string | undefined;
  getInlineQueryShadowedAliases?: (inlineQuery: InlineQuery) => ReadonlySet<string>;
  skipUnqualifiedInInlineQueries?: boolean;
  skipInlineQueries?: boolean;
}

export function resolveColumnReferences(value: unknown, sources: SourceReferenceTarget[], options: ResolveColumnReferencesOptions = {}): LineageColumnRef[] {
  return resolveColumnReferencesWithIssues(value, sources, options).resolved;
}

export function resolveColumnReferencesWithIssues(
  value: unknown,
  sources: SourceReferenceTarget[],
  options: ResolveColumnReferencesOptions = {},
): { resolved: LineageColumnRef[]; unresolved: LineageUnresolvedColumnReference[] } {
  const sourceByAlias = new Map<string, SourceReferenceTarget>();
  for (const source of sources) {
    for (const alias of source.aliases) {
      sourceByAlias.set(alias, source);
    }
  }

  const resolved: LineageColumnRef[] = [];
  const unresolved: LineageUnresolvedColumnReference[] = [];
  const seen = new Set<string>();
  const seenUnresolved = new Set<string>();
  for (const reference of collectColumnReferences(value, options)) {
    const columnName = reference.column.name;
    if (columnName === '*') {
      continue;
    }

    const namespace = reference.getNamespace();
    const resolution = namespace
      ? { source: sourceByAlias.get(namespace) ?? null, unresolved: sourceByAlias.has(namespace) ? undefined : createUnknownQualifiedSource(reference, sources, options) }
      : resolveUnqualifiedColumnSourceWithIssue(columnName, reference, sources, options);
    const source = resolution.source;
    if (!source) {
      const issue = resolution.unresolved;
      if (issue) {
        const key = `${issue.reason}:${issue.qualifier ?? ''}:${issue.columnName}:${issue.candidateNodeIds?.join(',') ?? ''}`;
        if (!seenUnresolved.has(key)) {
          seenUnresolved.add(key);
          unresolved.push(issue);
        }
      }
      continue;
    }

    const key = `${source.nodeId}.${columnName}`;
    if (!seen.has(key)) {
      seen.add(key);
      resolved.push({
        nodeId: source.nodeId,
        columnName,
      });
    }
  }
  return { resolved, unresolved };
}

export function collectColumnReferences(
  value: unknown,
  options: Pick<ResolveColumnReferencesOptions, 'getInlineQueryShadowedAliases' | 'skipInlineQueries' | 'skipUnqualifiedInInlineQueries'> = {},
): ColumnReference[] {
  const references: ColumnReference[] = [];
  const visited = new Set<unknown>();

  const visit = (current: unknown, insideInlineQuery = false, shadowedAliases: ReadonlySet<string> = new Set()): void => {
    if (!current || typeof current !== 'object' || visited.has(current)) {
      return;
    }
    visited.add(current);

    if (options.skipInlineQueries && current instanceof InlineQuery) {
      return;
    }

    if (current instanceof ColumnReference) {
      const namespace = current.getNamespace();
      if (
        options.skipUnqualifiedInInlineQueries && insideInlineQuery && !namespace
        || namespace && shadowedAliases.has(namespace)
      ) {
        return;
      }
      references.push(current);
      return;
    }

    const nestedInsideInlineQuery = insideInlineQuery || current instanceof InlineQuery;
    const nestedShadowedAliases = current instanceof InlineQuery
      ? new Set([...shadowedAliases, ...(options.getInlineQueryShadowedAliases?.(current) ?? [])])
      : shadowedAliases;
    for (const nested of Object.values(current)) {
      if (Array.isArray(nested)) {
        nested.forEach((item) => visit(item, nestedInsideInlineQuery, nestedShadowedAliases));
      } else {
        visit(nested, nestedInsideInlineQuery, nestedShadowedAliases);
      }
    }
  };

  visit(value);
  return references;
}

function resolveUnqualifiedColumnSourceWithIssue(
  columnName: string,
  reference: ColumnReference | undefined,
  sources: SourceReferenceTarget[],
  options: ResolveColumnReferencesOptions,
): { source: SourceReferenceTarget | null; unresolved?: LineageUnresolvedColumnReference } {
  if (sources.length === 1) {
    return { source: sources[0] };
  }

  const candidates = sources.filter((source) => source.columnNames.includes(columnName));
  if (candidates.length === 1) {
    return { source: candidates[0] };
  }

  if (candidates.length > 1) {
    return {
      source: null,
      unresolved: {
        candidateNodeIds: candidates.map((source) => source.nodeId),
        columnName,
        reason: 'ambiguous_unqualified_column',
        sql: reference ? (options.formatExpressionSql?.(reference) ?? columnName) : columnName,
        suggestion: 'Add a table alias to the column reference so the source is explicit.',
      },
    };
  }

  return {
    source: null,
    unresolved: {
      candidateNodeIds: sources.map((source) => source.nodeId),
      columnName,
      reason: 'unknown_unqualified_column',
      sql: reference ? (options.formatExpressionSql?.(reference) ?? columnName) : columnName,
      suggestion: sources.some((source) => source.nodeType === 'table' && source.columnNames.length === 0)
        ? 'Provide DDL/schema facts, or qualify the column with a table alias if the source is known.'
        : 'Check the column name or qualify it with a table alias.',
    },
  };
}

function createUnknownQualifiedSource(
  reference: ColumnReference,
  sources: SourceReferenceTarget[],
  options: ResolveColumnReferencesOptions,
): LineageUnresolvedColumnReference {
  const qualifier = reference.getNamespace();
  return {
    candidateNodeIds: sources.map((source) => source.nodeId),
    columnName: reference.column.name,
    qualifier: qualifier ?? undefined,
    reason: 'unknown_qualified_source',
    sql: options.formatExpressionSql?.(reference) ?? reference.column.name,
    suggestion: qualifier
      ? `Alias or source "${qualifier}" is not in scope. Check the FROM/JOIN alias, or add the missing alias.`
      : 'Add a table alias to the column reference.',
  };
}
