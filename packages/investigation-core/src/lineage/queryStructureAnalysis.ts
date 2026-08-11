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
import { analyzeSql } from './rawsqlAdapter';
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
  id: string;
  kind: LineageScope['kind'];
  label?: string;
  nodeId: string;
  parentScopeId?: string;
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
  const { lineage, parserVersion } = analyzeSql(input.sql, {
    analysisMode: 'original',
    optimizeConditions: false,
    schemaFacts,
  });
  const scopes = lineage.scopes.map((scope) => ({
    id: scope.id,
    kind: scope.kind,
    ...(scope.label ? { label: scope.label } : {}),
    nodeId: scope.nodeId,
    ...(scope.parentScopeId ? { parentScopeId: scope.parentScopeId } : {}),
  }));
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
      maximumNestingDepth: maximumNestingDepth(lineage.scopes),
      outputColumnCount: outputNode?.columns.filter((column) => column.usage?.role !== 'filter').length ?? 0,
      physicalTableCount: lineage.nodes.filter((node) => node.type === 'table').length,
      scalarSubqueryCount: lineage.nodes.filter((node) => node.type === 'scalar_subquery').length,
      scopeCount: lineage.scopes.length,
      version: 1,
    },
    version: 1,
  };
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

function maximumNestingDepth(scopes: LineageScope[]): number {
  const parentById = new Map(scopes.map((scope) => [scope.id, scope.parentScopeId]));
  const depthFor = (scopeId: string, seen = new Set<string>()): number => {
    if (seen.has(scopeId)) return 0;
    seen.add(scopeId);
    const parent = parentById.get(scopeId);
    return 1 + (parent ? depthFor(parent, seen) : 0);
  };
  return scopes.reduce((maximum, scope) => Math.max(maximum, depthFor(scope.id)), 0);
}
