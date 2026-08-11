import type {
  LineageImpact,
  LineageModel,
  LineageNode,
  LineageNodeDependencyProfile,
  LineagePopulationEffect,
  LineageScope,
} from '../domain/lineage';

export function attachNodeDependencyProfiles(lineage: LineageModel): LineageModel {
  return {
    ...lineage,
    nodes: lineage.nodes.map((node) => ({
      ...node,
      dependencyProfile: buildNodeDependencyProfile(lineage, node),
    })),
  };
}

function buildNodeDependencyProfile(lineage: LineageModel, node: LineageNode): LineageNodeDependencyProfile {
  const dataFlowEdges = lineage.edges.filter((edge) => edge.type === 'dataFlow');
  const inputNodeIds = uniqueSorted(
    dataFlowEdges
      .filter((edge) => edge.target === node.id && edge.source !== node.id)
      .map((edge) => edge.source),
  );
  const consumerNodeIds = uniqueSorted(
    dataFlowEdges
      .filter((edge) => edge.source === node.id && edge.target !== node.id)
      .map((edge) => edge.target),
  );
  const scopes = lineage.scopes.filter((scope) => scope.nodeId === node.id);
  const populationEffects = uniquePopulationEffects(populationEffectsFromImpacts(scopes.flatMap(collectScopeImpacts)));
  const nodeEdges = dataFlowEdges.filter((edge) => edge.source === node.id || edge.target === node.id);

  return {
    consumerNodeCount: consumerNodeIds.length,
    consumerNodeIds,
    hasGroupBy: scopes.some((scope) => Boolean(scope.groupBy?.length)),
    hasHaving: scopes.some((scope) => Boolean(scope.having?.length)),
    hasJoin: scopes.some((scope) => Boolean(scope.joins?.length)),
    hasLimit: scopes.some((scope) => Boolean(scope.limit)),
    hasOffset: scopes.some((scope) => Boolean(scope.offset)),
    hasOrderBy: scopes.some((scope) => Boolean(scope.orderBy?.length)),
    hasSetOperation: nodeEdges.some((edge) => isSetOperationLabel(edge.label)),
    hasWhere: scopes.some((scope) => Boolean(scope.where?.length)),
    inputNodeCount: inputNodeIds.length,
    inputNodeIds,
    isRecursive: Boolean(node.recursive || nodeEdges.some((edge) => edge.recursive)),
    populationEffects,
    scopeIds: scopes.map((scope) => scope.id),
  };
}

function collectScopeImpacts(scope: LineageScope): LineageImpact[] {
  return [
    ...(scope.where ?? []).flatMap((condition) => condition.impact),
    ...(scope.having ?? []).flatMap((condition) => condition.impact),
    ...(scope.distinct?.impact ?? []),
    ...(scope.distinctOn ?? []).flatMap((expression) => expression.impact),
    ...(scope.groupBy ?? []).flatMap((expression) => expression.impact),
    ...(scope.orderBy ?? []).flatMap((expression) => expression.impact),
    ...(scope.limit?.impact ?? []),
    ...(scope.offset?.impact ?? []),
    ...(scope.joins ?? []).flatMap((join) => join.impact),
  ];
}

function populationEffectsFromImpacts(impacts: LineageImpact[]): LineagePopulationEffect[] {
  return impacts
    .map(populationEffectFromImpact)
    .filter((effect): effect is LineagePopulationEffect => Boolean(effect));
}

function populationEffectFromImpact(impact: LineageImpact): LineagePopulationEffect | null {
  switch (impact) {
    case 'may_change_grain':
      return 'grain_change';
    case 'may_filter_rows':
      return 'row_filter';
    case 'may_limit_rows':
      return 'output_cap';
    case 'may_deduplicate_rows':
      return 'row_deduplication';
    case 'may_multiply_rows':
      return 'row_multiplication';
    case 'may_null_extend_rows':
      return 'null_extension';
    case 'may_change_order':
      return 'output_selection';
    default:
      return null;
  }
}

function uniquePopulationEffects(effects: LineagePopulationEffect[]): LineagePopulationEffect[] {
  return [...new Set(effects)].sort();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function isSetOperationLabel(label?: string): boolean {
  return Boolean(label && /^(union|union all|intersect|except)$/i.test(label.trim()));
}
