import {
  ArrayQueryExpression,
  BinarySelectQuery,
  ColumnReference,
  FunctionSource,
  InlineQuery,
  ParenSource,
  QueryScopeCollector,
  SelectOutputCollector,
  SimpleSelectQuery,
  SqlComponent,
  SubQuerySource,
  TableSource,
  ValuesQuery,
  queryScopeSelectorKey,
} from 'rawsql-ts';
import type {
  QueryScopeAstV1,
  QueryScopeKind,
  QueryScopeSelectorV1,
  SelectQuery,
  SourceComponent,
  SourceExpression,
} from 'rawsql-ts';
import type { SchemaFacts } from './schemaFacts';
import { createTableColumnResolver, resolveTableFacts } from './schemaFacts';

export type OuterReferenceStatusV1 = 'none' | 'correlated' | 'unresolved';

/** Public, AST-free metadata for one parser-backed query scope. */
export interface QueryScopeMetadataV1 {
  directCteNames: string[];
  kind: QueryScopeKind;
  outerReferenceStatus: OuterReferenceStatusV1;
  parentSelector?: QueryScopeSelectorV1;
  selector: QueryScopeSelectorV1;
}

interface SourceOwnership {
  aliases: string[];
  columnNames: string[];
  columnsKnown: boolean;
}

interface AnalyzedScope {
  ast: QueryScopeAstV1;
  localSources: SourceOwnership[];
  metadata: QueryScopeMetadataV1;
  outerSources: SourceOwnership[];
}

/**
 * Adds investigation semantics to core query scopes without exposing their ASTs.
 * Unknown unqualified ownership is classified as unresolved instead of none.
 */
export function analyzeQueryScopes(
  query: SelectQuery,
  schemaFacts?: SchemaFacts,
): QueryScopeMetadataV1[] {
  const astScopes = new QueryScopeCollector().collect(query);
  return analyzeCollectedQueryScopes(astScopes, schemaFacts);
}

/** Internal bridge for callers that already retain the core collector result. */
export function analyzeCollectedQueryScopes(
  astScopes: QueryScopeAstV1[],
  schemaFacts?: SchemaFacts,
): QueryScopeMetadataV1[] {
  const analyzedBySelector = new Map<string, AnalyzedScope>();
  const result: QueryScopeMetadataV1[] = [];

  for (const ast of astScopes) {
    const parent = ast.parentSelector
      ? analyzedBySelector.get(queryScopeSelectorKey(ast.parentSelector))
      : undefined;
    const localSources = collectLocalSources(ast.query, ast.visibleCteNames, schemaFacts);
    const outerSources = accessibleOuterSources(ast, parent);
    const metadata: QueryScopeMetadataV1 = {
      directCteNames: collectDirectCteNames(ast.query, ast.visibleCteNames),
      kind: ast.kind,
      outerReferenceStatus: ast.kind === 'root'
        ? 'none'
        : classifyOuterReferences(collectDirectColumnReferences(ast.query), localSources, outerSources),
      ...(ast.parentSelector ? { parentSelector: ast.parentSelector } : {}),
      selector: ast.selector,
    };
    analyzedBySelector.set(queryScopeSelectorKey(ast.selector), {
      ast,
      localSources,
      metadata,
      outerSources,
    });
    result.push(metadata);
  }

  return result;
}

function accessibleOuterSources(ast: QueryScopeAstV1, parent: AnalyzedScope | undefined): SourceOwnership[] {
  if (!ast.allowsOuterReferences || !parent) {
    return [];
  }
  if (ast.kind === 'set_operation') {
    return parent.outerSources;
  }
  const location = ast.selector.path.at(-1);
  if (ast.kind === 'derived' && location?.kind === 'source_subquery' && location.source === 'join') {
    // A LATERAL join source can see the primary FROM source and earlier joins,
    // but never its own alias or later joins.
    return dedupeSources([
      ...parent.localSources.slice(0, location.index + 1),
      ...parent.outerSources,
    ]);
  }
  return dedupeSources([...parent.localSources, ...parent.outerSources]);
}

function collectDirectCteNames(query: SelectQuery, visibleCteNames: string[]): string[] {
  const visible = new Set(visibleCteNames);
  const names: string[] = [];
  for (const source of directSourceExpressions(query)) {
    const datasource = unwrapParenSource(source.datasource);
    if (datasource instanceof TableSource && visible.has(datasource.getSourceName())) {
      names.push(datasource.getSourceName());
    }
  }
  return [...new Set(names)];
}

function collectLocalSources(
  query: SelectQuery,
  visibleCteNames: string[],
  schemaFacts?: SchemaFacts,
): SourceOwnership[] {
  return directSourceExpressions(query).map((source) => sourceOwnership(source, visibleCteNames, schemaFacts));
}

function directSourceExpressions(query: SelectQuery): SourceExpression[] {
  if (!(query instanceof SimpleSelectQuery) || !query.fromClause) {
    return [];
  }
  return query.fromClause.getSources();
}

function sourceOwnership(
  source: SourceExpression,
  visibleCteNames: string[],
  schemaFacts?: SchemaFacts,
): SourceOwnership {
  const datasource = unwrapParenSource(source.datasource);
  const aliases = sourceAliases(source, datasource);
  const explicitColumns = source.aliasExpression?.columns?.map((column) => column.name);
  if (explicitColumns) {
    return { aliases, columnNames: explicitColumns, columnsKnown: true };
  }

  if (datasource instanceof TableSource) {
    const sourceName = datasource.getSourceName();
    if (visibleCteNames.includes(sourceName)) {
      return { aliases, columnNames: [], columnsKnown: false };
    }
    const table = resolveTableFacts(schemaFacts, sourceName);
    return {
      aliases,
      columnNames: table ? Object.keys(table.columns) : [],
      columnsKnown: Boolean(table),
    };
  }

  if (datasource instanceof SubQuerySource) {
    const resolver = schemaFacts ? createTableColumnResolver(schemaFacts) : null;
    try {
      const outputs = new SelectOutputCollector(resolver).collect(datasource.query);
      return {
        aliases,
        columnNames: outputs.map((output) => output.name),
        columnsKnown: hasCompleteOutputList(datasource.query, outputs.length),
      };
    } catch {
      return { aliases, columnNames: [], columnsKnown: false };
    }
  }

  if (datasource instanceof FunctionSource) {
    return { aliases, columnNames: [], columnsKnown: false };
  }

  return { aliases, columnNames: [], columnsKnown: false };
}

function hasCompleteOutputList(query: SelectQuery, outputCount: number): boolean {
  if (query instanceof SimpleSelectQuery) {
    const hasWildcard = query.selectClause.items.some((item) =>
      item.value instanceof ColumnReference && item.value.column.name === '*');
    return !hasWildcard && outputCount === query.selectClause.items.length;
  }
  if (query instanceof ValuesQuery) {
    return Boolean(query.columnAliases && query.columnAliases.length === outputCount);
  }
  return false;
}

function sourceAliases(source: SourceExpression, datasource: SourceComponent): string[] {
  if (source.aliasExpression) {
    return [source.aliasExpression.table.name];
  }
  if (datasource instanceof TableSource) {
    const fullName = datasource.getSourceName();
    return [...new Set([fullName, datasource.table.name])];
  }
  if (datasource instanceof FunctionSource) {
    const name = 'name' in datasource.name ? datasource.name.name : datasource.name.value;
    return [name];
  }
  return [];
}

function classifyOuterReferences(
  references: ColumnReference[],
  localSources: SourceOwnership[],
  outerSources: SourceOwnership[],
): OuterReferenceStatusV1 {
  let unresolved = false;
  let correlated = false;

  for (const reference of references) {
    const qualifier = reference.getNamespace();
    const columnName = reference.column.name;
    if (qualifier) {
      if (localSources.some((source) => source.aliases.includes(qualifier))) {
        continue;
      }
      if (outerSources.some((source) => source.aliases.includes(qualifier))) {
        correlated = true;
      } else {
        unresolved = true;
      }
      continue;
    }

    if (columnName === '*') {
      if (localSources.length === 0) {
        unresolved = true;
      }
      continue;
    }

    const local = resolveUnqualified(columnName, localSources);
    if (local === 'one') {
      continue;
    }
    if (local === 'ambiguous') {
      unresolved = true;
      continue;
    }
    if (local === 'unknown') {
      if (outerSources.length === 0 && localSources.length === 1) {
        continue;
      }
      unresolved = true;
      continue;
    }

    const outer = resolveUnqualified(columnName, outerSources);
    if (outer === 'one') {
      correlated = true;
    } else {
      unresolved = true;
    }
  }

  return unresolved ? 'unresolved' : correlated ? 'correlated' : 'none';
}

function resolveUnqualified(
  columnName: string,
  sources: SourceOwnership[],
): 'none' | 'one' | 'ambiguous' | 'unknown' {
  const knownMatches = sources.filter((source) => source.columnsKnown && source.columnNames.includes(columnName));
  const unknownSources = sources.filter((source) => !source.columnsKnown);
  if (knownMatches.length > 1 || knownMatches.length === 1 && unknownSources.length > 0) {
    return 'ambiguous';
  }
  if (knownMatches.length === 1) {
    return 'one';
  }
  if (unknownSources.length > 0) {
    return 'unknown';
  }
  return 'none';
}

function collectDirectColumnReferences(query: SelectQuery): ColumnReference[] {
  if (query instanceof BinarySelectQuery) {
    return [];
  }
  const roots: unknown[] = [];
  if (query instanceof SimpleSelectQuery) {
    roots.push(
      query.selectClause,
      query.whereClause,
      query.groupByClause,
      query.havingClause,
      query.orderByClause,
      query.windowClause,
      query.limitClause,
      query.offsetClause,
      query.fetchClause,
    );
    if (query.fromClause) {
      const sources = query.fromClause.getSources();
      for (const source of sources) {
        const datasource = unwrapParenSource(source.datasource);
        if (datasource instanceof FunctionSource) {
          roots.push(datasource.argument);
        }
      }
      roots.push(...(query.fromClause.joins ?? []).map((join) => join.condition));
    }
  } else if (query instanceof ValuesQuery) {
    roots.push(query.tuples);
  }

  const references: ColumnReference[] = [];
  const visited = new Set<unknown>();
  const visit = (current: unknown): void => {
    if (!current || typeof current !== 'object' || visited.has(current)) {
      return;
    }
    visited.add(current);
    if (current instanceof InlineQuery || current instanceof ArrayQueryExpression || current instanceof SubQuerySource) {
      return;
    }
    if (current instanceof ColumnReference) {
      references.push(current);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (current instanceof SqlComponent) {
      Object.keys(current).sort().forEach((key) => visit((current as unknown as Record<string, unknown>)[key]));
    }
  };
  roots.forEach(visit);
  return references;
}

function unwrapParenSource(source: SourceComponent): SourceComponent {
  let current = source;
  while (current instanceof ParenSource) {
    current = current.source;
  }
  return current;
}

function dedupeSources(sources: SourceOwnership[]): SourceOwnership[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.aliases.join('\u0000');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
