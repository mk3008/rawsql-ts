import type {
  AnalysisWarning,
  LineageCondition,
  LineageExpressionInfluence,
  LineageImpact,
  LineageJoinInfluence,
  LineageNode,
  LineageNodeType,
  LineageScope,
  LineageSourceReference,
} from '../domain/lineage';
import { QueryScopeCollector, queryScopeSelectorKey } from 'rawsql-ts';
import type { QueryScopeKind, QueryScopeSelectorV1, SelectQuery } from 'rawsql-ts';
import { analyzeSql } from './rawsqlAdapter';
import { analyzeCollectedQueryScopes, type OuterReferenceStatusV1 } from './queryScopeAnalysis';
import { parseSchemaFactsFromDdl, type DdlInput, type SchemaFacts } from './schemaFacts';

export interface QueryStructureAnalysisInputV1 {
  /** Submitted SQL analyzed without rewriting or execution. */
  sql: string;
  ddl?: DdlInput[];
  schemaFacts?: SchemaFacts;
}

export interface QueryStructureSummaryV1 {
  cteCount: number;
  derivedQueryCount: number;
  kind: 'query-structure-summary';
  maximumNestingDepth: number;
  outputColumnCount: number;
  physicalTableCount: number;
  scalarSubqueryCount: number;
  scopeCount: number;
  version: 1;
}

/** A query component, including physical tables and query-defined relations. */
export interface QueryStructureComponentV1 {
  directCteNames: string[];
  directTableNames: string[];
  id: string;
  kind: LineageNodeType;
  label: string;
  populationEffects: string[];
  scopeIds: string[];
}

/** One clause that can change which rows reach a query scope. */
export interface QueryStructureOperationV1 {
  effects: LineageImpact[];
  expressionSql?: string;
  joinType?: LineageJoinInfluence['joinType'];
  kind: string;
  references: LineageSourceReference[];
  scopeId: string;
}

export interface QueryStructureScopeV1 {
  directCteNames: string[];
  id: string;
  kind: LineageScope['kind'];
  label?: string;
  nodeId: string;
  outerReferenceStatus: OuterReferenceStatusV1;
  parentScopeId?: string;
  parentSelector?: QueryScopeSelectorV1;
  scopeKind: QueryScopeKind;
  selector: QueryScopeSelectorV1;
}

export interface QueryStructureAnalysisV1 {
  analysisMode: 'original';
  analysisWarnings: AnalysisWarning[];
  components: QueryStructureComponentV1[];
  kind: 'query-structure-analysis';
  operations: QueryStructureOperationV1[];
  parserVersion: string;
  scopes: QueryStructureScopeV1[];
  summary: QueryStructureSummaryV1;
  version: 1;
}

/**
 * Describes how a query is composed from relations and row-set operations.
 * The result is static: it neither executes the query nor reports runtime rows.
 */
export function analyzeQueryStructure(input: QueryStructureAnalysisInputV1): QueryStructureAnalysisV1 {
  const schemaFacts = input.schemaFacts ?? (input.ddl ? parseSchemaFactsFromDdl(input.ddl) : undefined);
  const { lineage, parserVersion, query, scopeQueries } = analyzeSql(input.sql, {
    analysisMode: 'original',
    optimizeConditions: false,
    schemaFacts,
  });
  const scopes = buildStructureScopes(query, lineage.scopes, scopeQueries, lineage.nodes, schemaFacts);
  const outputNode = lineage.nodes.find((node) => node.id === 'main_output');
  return {
    analysisMode: 'original',
    analysisWarnings: lineage.analysisWarnings,
    components: lineage.nodes.map(toComponent),
    kind: 'query-structure-analysis',
    operations: lineage.scopes.flatMap(operationsForScope),
    parserVersion,
    scopes,
    summary: {
      cteCount: lineage.nodes.filter((node) => node.type === 'cte').length,
      derivedQueryCount: lineage.nodes.filter((node) => node.type === 'derived').length,
      kind: 'query-structure-summary',
      maximumNestingDepth: maximumNestingDepth(scopes),
      outputColumnCount: outputNode?.columns.filter((column) => column.usage?.role !== 'filter').length ?? 0,
      physicalTableCount: lineage.nodes.filter((node) => node.type === 'table').length,
      scalarSubqueryCount: lineage.nodes.filter((node) => node.type === 'scalar_subquery').length,
      scopeCount: scopes.length,
      version: 1,
    },
    version: 1,
  };
}

function buildStructureScopes(
  query: SelectQuery,
  lineageScopes: LineageScope[],
  scopeQueries: ReadonlyMap<string, SelectQuery>,
  nodes: LineageNode[],
  schemaFacts?: SchemaFacts,
): QueryStructureScopeV1[] {
  const astScopes = new QueryScopeCollector().collect(query);
  const metadata = analyzeCollectedQueryScopes(astScopes, schemaFacts);
  const legacyByQuery = mapLegacyScopesByQuery(lineageScopes, scopeQueries);

  const idBySelector = new Map<string, string>();
  const nodeIdBySelector = new Map<string, string>();
  const selectorKeyByLegacyId = new Map<string, string>();
  const scopeBySelector = new Map<string, QueryStructureScopeV1>();
  const structuralOrder = astScopes.map((ast, index) => {
    const scopeMetadata = metadata[index];
    const legacy = legacyByQuery.get(ast.query);
    const selectorKey = queryScopeSelectorKey(ast.selector);
    const parentKey = ast.parentSelector ? queryScopeSelectorKey(ast.parentSelector) : undefined;
    const id = legacy?.id ?? syntheticScopeId(selectorKey);
    const nodeId = legacy?.nodeId
      ?? cteNodeId(ast.selector, nodes)
      ?? (parentKey ? nodeIdBySelector.get(parentKey) : undefined)
      ?? 'main_output';
    idBySelector.set(selectorKey, id);
    nodeIdBySelector.set(selectorKey, nodeId);
    const structureScope: QueryStructureScopeV1 = {
      directCteNames: scopeMetadata.directCteNames,
      id,
      kind: legacy?.kind ?? legacyCompatibleScopeKind(ast.kind),
      ...(legacy?.label ? { label: legacy.label } : {}),
      nodeId,
      outerReferenceStatus: scopeMetadata.outerReferenceStatus,
      ...(legacy?.parentScopeId
        ? { parentScopeId: legacy.parentScopeId }
        : parentKey && idBySelector.get(parentKey)
          ? { parentScopeId: idBySelector.get(parentKey) }
          : {}),
      ...(scopeMetadata.parentSelector ? { parentSelector: scopeMetadata.parentSelector } : {}),
      scopeKind: scopeMetadata.kind,
      selector: scopeMetadata.selector,
    };
    scopeBySelector.set(selectorKey, structureScope);
    if (legacy) {
      selectorKeyByLegacyId.set(legacy.id, selectorKey);
    }
    return structureScope;
  });

  const existingOrder = lineageScopes.map((scope) => {
    const selectorKey = selectorKeyByLegacyId.get(scope.id);
    const structureScope = selectorKey ? scopeBySelector.get(selectorKey) : undefined;
    if (!structureScope) {
      throw new Error(`Unable to attach a structural selector to lineage scope: ${scope.id}`);
    }
    return structureScope;
  });
  const newScopes = structuralOrder.filter((scope) => !lineageScopes.some((legacy) => legacy.id === scope.id));
  return [...existingOrder, ...newScopes];
}

function mapLegacyScopesByQuery(
  lineageScopes: LineageScope[],
  scopeQueries: ReadonlyMap<string, SelectQuery>,
): Map<SelectQuery, LineageScope> {
  const legacyByQuery = new Map<SelectQuery, LineageScope>();
  for (const scope of lineageScopes) {
    const scopeQuery = scopeQueries.get(scope.id);
    if (!scopeQuery) {
      throw new Error(`Lineage scope is missing its parsed query identity: ${scope.id}`);
    }
    const existing = legacyByQuery.get(scopeQuery);
    if (existing) {
      throw new Error(`Lineage scopes share one parsed query identity: ${existing.id}, ${scope.id}`);
    }
    legacyByQuery.set(scopeQuery, scope);
  }
  return legacyByQuery;
}

function legacyCompatibleScopeKind(kind: QueryScopeKind): LineageScope['kind'] {
  switch (kind) {
    case 'root':
      return 'select';
    case 'exists':
    case 'in_subquery':
      return 'subquery';
    case 'cte':
    case 'derived':
    case 'scalar_subquery':
    case 'set_operation':
      return kind;
  }
}

function syntheticScopeId(selectorKey: string): string {
  return `query_scope:${selectorKey}`;
}

function cteNodeId(selector: QueryScopeSelectorV1, nodes: LineageNode[]): string | undefined {
  const segment = selector.path.at(-1);
  if (segment?.kind !== 'cte') {
    return undefined;
  }
  return nodes.find((node) => (node.type === 'cte' || node.type === 'parameter_table') && node.label === segment.name)?.id;
}

function toComponent(node: LineageNode): QueryStructureComponentV1 {
  return {
    directCteNames: node.queryDependencies?.directCteNames ?? [],
    directTableNames: node.queryDependencies?.directTableNames ?? [],
    id: node.id,
    kind: node.type,
    label: node.label,
    populationEffects: node.dependencyProfile?.populationEffects ?? [],
    scopeIds: node.dependencyProfile?.scopeIds ?? [],
  };
}

function operationsForScope(scope: LineageScope): QueryStructureOperationV1[] {
  return [
    ...(scope.where ?? []).map((condition) => conditionOperation('where', condition)),
    ...(scope.having ?? []).map((condition) => conditionOperation('having', condition)),
    ...(scope.joins ?? []).map(joinOperation),
    ...expressionOperations('group_by', scope.groupBy),
    ...expressionOperations('distinct', scope.distinct ? [scope.distinct] : undefined),
    ...expressionOperations('distinct_on', scope.distinctOn),
    ...expressionOperations('order_by', scope.orderBy),
    ...expressionOperations('limit', scope.limit ? [scope.limit] : undefined),
    ...expressionOperations('offset', scope.offset ? [scope.offset] : undefined),
  ];
}

function conditionOperation(kind: string, condition: LineageCondition): QueryStructureOperationV1 {
  return {
    effects: condition.impact,
    expressionSql: condition.expressionSql,
    kind,
    references: condition.references,
    scopeId: condition.scopeId,
  };
}

function joinOperation(join: LineageJoinInfluence): QueryStructureOperationV1 {
  return {
    effects: join.impact,
    ...(join.condition ? { expressionSql: join.condition.expressionSql } : {}),
    joinType: join.joinType,
    kind: 'join',
    references: join.references,
    scopeId: join.scopeId,
  };
}

function expressionOperations(kind: string, influences: LineageExpressionInfluence[] | undefined): QueryStructureOperationV1[] {
  return (influences ?? []).map((influence) => ({
    effects: influence.impact,
    expressionSql: influence.expressionSql,
    kind,
    references: influence.references,
    scopeId: influence.scopeId,
  }));
}

function maximumNestingDepth(scopes: QueryStructureScopeV1[]): number {
  const parentById = new Map(scopes.map((scope) => [scope.id, scope.parentSelector
    ? scopes.find((candidate) => queryScopeSelectorKey(candidate.selector) === queryScopeSelectorKey(scope.parentSelector!))?.id
    : undefined]));
  const depthFor = (scopeId: string, seen = new Set<string>()): number => {
    if (seen.has(scopeId)) return 0;
    seen.add(scopeId);
    const parent = parentById.get(scopeId);
    return 1 + (parent ? depthFor(parent, seen) : 0);
  };
  return scopes.reduce((maximum, scope) => Math.max(maximum, depthFor(scope.id)), 0);
}
