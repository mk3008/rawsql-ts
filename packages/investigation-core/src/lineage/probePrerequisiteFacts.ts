import {
  BinarySelectQuery,
  CaseExpression,
  ColumnReference,
  FunctionCall,
  InlineQuery,
  LiteralValue,
  SimpleSelectQuery,
  SqlParser,
  SubQuerySource,
} from 'rawsql-ts';
import type { LineageColumnRef, LineageModel, LineageNodeType } from '../domain/lineage';
import type { InvestigationPlannerParametersV1, InvestigationTargetV1 } from './investigationPlan';
import type { SchemaFacts } from './schemaFacts';
import { collectColumnReferences } from './source-references/resolveColumnReferences';

export type PrerequisiteFactStatusV1 = 'available' | 'ambiguous' | 'blocked' | 'unsupported';

interface TargetReachability {
  ambiguousNodeIds: Set<string>;
  nodeIds: Set<string>;
  traversedEdgeIds: Set<string>;
}
export type PrerequisiteIssueCodeV1 =
  | 'aggregate_input_ambiguous'
  | 'aggregate_input_multi_relation'
  | 'aggregate_input_scalar_subquery'
  | 'aggregate_operation_unsupported'
  | 'aggregate_window_unsupported'
  | 'dialect_aggregate_unsupported'
  | 'group_alias_unresolved'
  | 'group_ordinal_unresolved'
  | 'observation_prerequisite_missing'
  | 'source_provenance_unreconstructable'
  | 'target_scope_unavailable'
  | 'wildcard_reference_ambiguous';

export interface ProbePrerequisiteIssueV1 {
  code: PrerequisiteIssueCodeV1;
  factIds: string[];
  message: string;
  status: Exclude<PrerequisiteFactStatusV1, 'available'>;
}

export interface ProbePrerequisiteReferenceV1 {
  columnName: string;
  id: string;
  nodeId: string;
  provenanceIds: string[];
  scopeId?: string;
  status: 'resolved';
}

export interface ProbePrerequisiteSourceV1 {
  directness: 'direct' | 'internal' | 'unknown';
  id: string;
  kind: 'cte' | 'derived' | 'physical_table' | 'unknown';
  nodeId: string;
  ownerNodeId?: string;
  ownerScopeId?: string;
  provenanceIds: string[];
  referenceIds: string[];
  roles: Array<'aggregate_input' | 'grouping_key' | 'internal_source' | 'query_source'>;
  scopeIds: string[];
  status: 'resolved' | 'ambiguous';
}

export interface AggregateOperationFactV1 {
  distinct: 'distinct' | 'not_distinct' | 'unknown';
  groupingKeyIds: string[];
  id: string;
  inputKind: 'case_expression' | 'column' | 'composite_expression' | 'scalar_subquery' | 'star' | 'unknown';
  inputReferenceIds: string[];
  issueCodes: PrerequisiteIssueCodeV1[];
  operation: 'avg' | 'count' | 'max' | 'min' | 'sum' | 'unknown';
  ownerNodeId: string;
  ownerScopeId?: string;
  provenanceIds: string[];
  sourceIds: string[];
  status: PrerequisiteFactStatusV1;
  target: { columnName: string; nodeId: string; outputIndex: number };
}

export interface GroupingKeyFactV1 {
  id: string;
  issueCodes: PrerequisiteIssueCodeV1[];
  kind: 'alias' | 'column' | 'expression' | 'ordinal';
  ordinal?: number;
  ownerNodeId: string;
  ownerScopeId?: string;
  provenanceIds: string[];
  referenceIds: string[];
  sourceIds: string[];
  status: PrerequisiteFactStatusV1;
}

export type ProbeObservationKindV1 =
  | 'aggregate_input_non_null_count'
  | 'aggregate_input_value_summary'
  | 'distinct_group_count'
  | 'rows_per_group'
  | 'source_row_count';

export interface ProbeObservationContractV1 {
  aggregateFactIds: string[];
  assumptions: string[];
  blockedReasons: PrerequisiteIssueCodeV1[];
  concernIds: string[];
  doesNotProve: string[];
  expectedColumns: Array<{ name: string; semanticType: 'count' | 'source_defined' | 'summary' }>;
  groupingKeyIds: string[];
  id: string;
  inconclusiveWhen: string[];
  kind: ProbeObservationKindV1;
  sourceIds: string[];
  status: 'available' | 'blocked';
}

export interface ProbePrerequisiteFactsV1 {
  aggregates: AggregateOperationFactV1[];
  groupingKeys: GroupingKeyFactV1[];
  issues: ProbePrerequisiteIssueV1[];
  kind: 'probe-prerequisite-facts';
  observations: ProbeObservationContractV1[];
  parameterDefinitionIds: string[];
  provenance: Array<{ id: string; kind: 'lineage_node' | 'lineage_scope' | 'parameter_definition' | 'parser_ast' | 'schema_facts'; sourceId: string }>;
  references: ProbePrerequisiteReferenceV1[];
  sources: ProbePrerequisiteSourceV1[];
  target: { columnName: string; nodeId: string; scopeId?: string; status: 'resolved' | 'unsupported' };
  version: 1;
}

const aggregateNames = new Set(['avg', 'count', 'max', 'min', 'sum']);

export function buildProbePrerequisiteFactsV1(input: {
  candidateConcernIds?: string[];
  lineage: LineageModel;
  parameters: InvestigationPlannerParametersV1;
  schemaFacts?: SchemaFacts;
  sql: string;
  target: InvestigationTargetV1;
}): ProbePrerequisiteFactsV1 {
  const ownerNode = input.lineage.nodes.find((node) => node.id === input.target.nodeId);
  const ownerScope = input.lineage.scopes.find((scope) => scope.nodeId === input.target.nodeId && scope.kind !== 'set_operation');
  const query = selectTargetQuery(input.sql, ownerNode);
  const provenance = new Map<string, ProbePrerequisiteFactsV1['provenance'][number]>();
  addProvenance(provenance, 'parser_ast', 'submitted_statement');
  if (ownerNode) addProvenance(provenance, 'lineage_node', ownerNode.id);
  if (ownerScope) addProvenance(provenance, 'lineage_scope', ownerScope.id);
  if (input.schemaFacts) addProvenance(provenance, 'schema_facts', `schema-facts-v${input.schemaFacts.version}`);
  const parameterDefinitionIds = [...input.parameters.definitions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((_definition, index) => {
      const sourceId = `definition:${String(index + 1).padStart(3, '0')}`;
      addProvenance(provenance, 'parameter_definition', sourceId);
      return `parameter-definition:${sourceId}`;
    });

  const reachability = collectReachableSources(input.lineage, input.target.nodeId);
  const references = collectReferences(input.lineage, reachability);
  for (const reference of references) {
    addProvenance(provenance, 'lineage_node', reference.nodeId);
    if (reference.scopeId) addProvenance(provenance, 'lineage_scope', reference.scopeId);
  }
  const sources = collectSources(input.lineage, references, provenance, input.target.nodeId, reachability);
  const groupingKeys = query ? collectGroupingKeys(query, input, ownerScope?.id, references, sources) : [];
  const aggregates = query ? collectAggregates(query, input, ownerScope?.id, references, sources, groupingKeys) : [];
  const issues = collectIssues(aggregates, groupingKeys, sources);
  if (!query) issues.push({ code: 'target_scope_unavailable', factIds: [], message: issueMessage('target_scope_unavailable'), status: 'unsupported' });
  const observations = observationContracts(aggregates, groupingKeys, sources, issues, input.candidateConcernIds ?? []);
  applySourceRoles(sources, aggregates, groupingKeys);
  return {
    aggregates: sortById(aggregates),
    groupingKeys: sortById(groupingKeys),
    issues: issues.map((issue) => ({ ...issue, factIds: sortedUnique(issue.factIds) })),
    kind: 'probe-prerequisite-facts',
    observations: sortById(observations),
    parameterDefinitionIds,
    provenance: [...provenance.values()].sort((a, b) => a.id.localeCompare(b.id)),
    references,
    sources: sortById(sources.map((source) => ({ ...source, provenanceIds: sortedUnique(source.provenanceIds), referenceIds: sortedUnique(source.referenceIds), roles: sortedUnique(source.roles), scopeIds: sortedUnique(source.scopeIds) }))),
    target: { columnName: input.target.columnName, nodeId: input.target.nodeId, ...(ownerScope ? { scopeId: ownerScope.id } : {}), status: query ? 'resolved' : 'unsupported' },
    version: 1,
  };
}

function unwrapSelect(value: unknown): SimpleSelectQuery | undefined {
  if (value instanceof SimpleSelectQuery) return value;
  if (value instanceof BinarySelectQuery) return undefined;
  const query = (value as { query?: unknown })?.query;
  return query instanceof SimpleSelectQuery ? query : undefined;
}

function selectTargetQuery(sql: string, ownerNode: LineageModel['nodes'][number] | undefined): SimpleSelectQuery | undefined {
  if (!ownerNode) return undefined;
  const targetSql = ownerNode.id === 'main_output' ? sql : ownerNode.querySql;
  if (!targetSql) return undefined;
  try { return unwrapSelect(SqlParser.parse(targetSql)); } catch { return undefined; }
}

function collectReferences(lineage: LineageModel, reachability: TargetReachability): ProbePrerequisiteReferenceV1[] {
  const refs = new Map<string, LineageColumnRef>();
  const traversedEdges = lineage.edges.filter((edge) => reachability.traversedEdgeIds.has(edge.id));
  const ownerNodeIds = new Set(traversedEdges.map((edge) => edge.target));
  const isTraversedReference = (ownerNodeId: string, ref: LineageColumnRef) => traversedEdges.some((edge) => edge.source === ref.nodeId && edge.target === ownerNodeId);
  const add = (ref: LineageColumnRef) => {
    const key = `${ref.nodeId}\u0000${ref.scopeId ?? ''}\u0000${ref.columnName}`;
    if (refs.has(key)) return;
    refs.set(key, { ...ref });
  };
  for (const node of [...lineage.nodes].filter((candidate) => ownerNodeIds.has(candidate.id)).sort((a, b) => a.id.localeCompare(b.id))) {
    for (const column of [...node.columns].sort((a, b) => (a.outputIndex ?? 9999) - (b.outputIndex ?? 9999) || a.name.localeCompare(b.name))) {
      for (const ref of column.upstream ?? []) if (reachability.nodeIds.has(ref.nodeId) && isTraversedReference(node.id, ref)) add(ref);
    }
  }
  for (const scope of [...lineage.scopes].filter((candidate) => ownerNodeIds.has(candidate.nodeId)).sort((a, b) => a.id.localeCompare(b.id))) {
    for (const influence of scope.groupBy ?? []) for (const ref of influence.references) if (reachability.nodeIds.has(ref.nodeId) && isTraversedReference(scope.nodeId, ref)) add(ref);
  }
  return [...refs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref], index) => ({
    columnName: ref.columnName,
    id: `reference:${String(index + 1).padStart(3, '0')}`,
    nodeId: ref.nodeId,
    provenanceIds: sortedUnique([`lineage-node:${ref.nodeId}`, ...(ref.scopeId ? [`lineage-scope:${ref.scopeId}`] : [])]),
    ...(ref.scopeId ? { scopeId: ref.scopeId } : {}),
    status: 'resolved',
  }));
}

function collectSources(lineage: LineageModel, references: ProbePrerequisiteReferenceV1[], provenance: Map<string, ProbePrerequisiteFactsV1['provenance'][number]>, selectedTargetNodeId: string, reachability: TargetReachability): ProbePrerequisiteSourceV1[] {
  return [...lineage.nodes]
    .filter((node) => reachability.nodeIds.has(node.id) && node.id !== selectedTargetNodeId && node.type !== 'output' && node.type !== 'parameter_table' && node.type !== 'scalar_subquery')
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((node, index) => {
      addProvenance(provenance, 'lineage_node', node.id);
      for (const scopeId of node.dependencyProfile?.scopeIds ?? []) addProvenance(provenance, 'lineage_scope', scopeId);
      const pathEdges = lineage.edges.filter((edge) => reachability.traversedEdgeIds.has(edge.id) && edge.source === node.id);
      const ownerNodeIds = sortedUnique(pathEdges.map((edge) => edge.target));
      const ownerNodeId = ownerNodeIds.length === 1 ? ownerNodeIds[0] : undefined;
      const ownerScopes = ownerNodeId ? lineage.scopes.filter((scope) => scope.nodeId === ownerNodeId && scope.kind !== 'set_operation') : [];
      const ownerScopeId = ownerScopes.length === 1 ? ownerScopes[0].id : undefined;
      if (ownerNodeId) addProvenance(provenance, 'lineage_node', ownerNodeId);
      if (ownerScopeId) addProvenance(provenance, 'lineage_scope', ownerScopeId);
      const ownershipEdges = ownerNodeId ? pathEdges.filter((edge) => edge.target === ownerNodeId) : [];
      const hasPredicateEvidence = ownershipEdges.some((edge) => edge.kind === 'predicate_subquery' || edge.kind === 'correlation');
      const hasNonPredicateEvidence = ownershipEdges.some((edge) => edge.kind !== 'predicate_subquery' && edge.kind !== 'correlation');
      const directness = reachability.ambiguousNodeIds.has(node.id) || ownerNodeIds.length !== 1 || hasPredicateEvidence && hasNonPredicateEvidence
        ? 'unknown' as const
        : hasPredicateEvidence ? 'internal' as const
          : ownerNodeId === selectedTargetNodeId ? 'direct' as const : ownerNodeId ? 'internal' as const : 'unknown' as const;
      return {
        directness,
        id: `source:${String(index + 1).padStart(3, '0')}`,
        kind: sourceKind(node.type),
        nodeId: node.id,
        ...(ownerNodeId ? { ownerNodeId } : {}),
        ...(ownerScopeId ? { ownerScopeId } : {}),
        provenanceIds: sortedUnique([`lineage-node:${node.id}`, ...(node.dependencyProfile?.scopeIds ?? []).map((id) => `lineage-scope:${id}`), ...(ownerScopeId ? [`lineage-scope:${ownerScopeId}`] : [])]),
        referenceIds: references.filter((reference) => reference.nodeId === node.id).map((reference) => reference.id),
        roles: [directness === 'direct' ? 'query_source' : 'internal_source'] as Array<'aggregate_input' | 'grouping_key' | 'internal_source' | 'query_source'>,
        scopeIds: sortedUnique([...(node.dependencyProfile?.scopeIds ?? []), ...(ownerScopeId ? [ownerScopeId] : [])]),
        status: directness !== 'unknown' && (node.type === 'table' || node.type === 'cte' || node.type === 'derived') ? 'resolved' as const : 'ambiguous' as const,
      };
    });
}

function collectReachableSources(lineage: LineageModel, selectedTargetNodeId: string): TargetReachability {
  const nodeIds = new Set<string>();
  const ambiguousNodeIds = new Set<string>();
  const traversedEdgeIds = new Set<string>();
  let cycleDetected = false;
  const walk = (ownerNodeId: string, path: ReadonlySet<string>): void => {
    const incomingEdges = lineage.edges.filter((edge) => edge.target === ownerNodeId);
    for (const edge of incomingEdges) traversedEdgeIds.add(edge.id);
    const sourceNodeIds = sortedUnique(incomingEdges.map((edge) => edge.source));
    for (const sourceNodeId of sourceNodeIds) {
      nodeIds.add(sourceNodeId);
      if (path.has(sourceNodeId)) {
        cycleDetected = true;
        ambiguousNodeIds.add(sourceNodeId);
        ambiguousNodeIds.add(ownerNodeId);
        continue;
      }
      walk(sourceNodeId, new Set([...path, sourceNodeId]));
    }
  };
  walk(selectedTargetNodeId, new Set([selectedTargetNodeId]));
  if (cycleDetected) for (const nodeId of nodeIds) ambiguousNodeIds.add(nodeId);
  return { ambiguousNodeIds, nodeIds, traversedEdgeIds };
}

function collectGroupingKeys(query: SimpleSelectQuery, input: Parameters<typeof buildProbePrerequisiteFactsV1>[0], ownerScopeId: string | undefined, references: ProbePrerequisiteReferenceV1[], sources: ProbePrerequisiteSourceV1[]): GroupingKeyFactV1[] {
  const lineageGroup = input.lineage.scopes.find((scope) => scope.id === ownerScopeId)?.groupBy ?? [];
  return (query.groupByClause?.grouping ?? []).map((value, index) => {
    const id = `grouping-key:${String(index + 1).padStart(3, '0')}`;
    const influenceRefs = lineageGroup[index]?.references ?? [];
    let referenceIds = matchReferences(references, influenceRefs);
    const issueCodes: PrerequisiteIssueCodeV1[] = [];
    let kind: GroupingKeyFactV1['kind'] = 'expression';
    let ordinal: number | undefined;
    let status: PrerequisiteFactStatusV1 = 'available';
    if (value instanceof LiteralValue && typeof value.value === 'number') {
      kind = 'ordinal'; ordinal = value.value;
      if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > query.selectClause.items.length) { status = 'blocked'; issueCodes.push('group_ordinal_unresolved'); }
      else referenceIds = selectItemReferenceIds(ordinal - 1, input, references);
      if (status === 'available' && referenceIds.length === 0) { status = 'blocked'; issueCodes.push('group_ordinal_unresolved'); }
    } else if (value instanceof ColumnReference) {
      const name = value.column.name;
      const aliasMatches = query.selectClause.items.filter((item) => item.identifier?.name === name && (!(item.value instanceof ColumnReference) || item.value.column.name !== name));
      kind = aliasMatches.length ? 'alias' : 'column';
      if (kind === 'alias' && aliasMatches.length !== 1) { status = 'blocked'; issueCodes.push('group_alias_unresolved'); }
      else if (kind === 'alias') {
        referenceIds = selectItemReferenceIds(query.selectClause.items.indexOf(aliasMatches[0]), input, references);
        if (referenceIds.length === 0) { status = 'blocked'; issueCodes.push('group_alias_unresolved'); }
      }
      else if (referenceIds.length === 0 && kind === 'column') { status = 'ambiguous'; issueCodes.push('wildcard_reference_ambiguous'); }
    }
    const sourceIds = sourceIdsForReferences(sources, references, referenceIds);
    return { id, issueCodes, kind, ...(ordinal !== undefined ? { ordinal } : {}), ownerNodeId: input.target.nodeId, ...(ownerScopeId ? { ownerScopeId } : {}), provenanceIds: sortedUnique(['parser-ast:submitted_statement', `lineage-node:${input.target.nodeId}`, ...(ownerScopeId ? [`lineage-scope:${ownerScopeId}`] : [])]), referenceIds, sourceIds, status };
  });
}

function collectAggregates(query: SimpleSelectQuery, input: Parameters<typeof buildProbePrerequisiteFactsV1>[0], ownerScopeId: string | undefined, references: ProbePrerequisiteReferenceV1[], sources: ProbePrerequisiteSourceV1[], groupingKeys: GroupingKeyFactV1[]): AggregateOperationFactV1[] {
  const ownerNode = input.lineage.nodes.find((node) => node.id === input.target.nodeId);
  return query.selectClause.items.flatMap((item, outputIndex) => {
    const calls = findFunctionCalls(item.value).filter((call) => aggregateNames.has(functionName(call)) || looksAggregate(call));
    return calls.map((call, callIndex) => {
      const name = functionName(call);
      const operation = aggregateNames.has(name) ? name as AggregateOperationFactV1['operation'] : 'unknown';
      const output = ownerNode?.columns.find((column) => column.outputIndex === outputIndex);
      const resolvedInput = resolveAggregateArgumentReferences(call.argument, output?.upstream ?? [], input.lineage, input.target.nodeId, references);
      const inputReferenceIds = resolvedInput.referenceIds;
      const sourceIds = sourceIdsForReferences(sources, references, inputReferenceIds);
      const issueCodes: PrerequisiteIssueCodeV1[] = [];
      if (call.over) issueCodes.push('aggregate_window_unsupported');
      if (operation === 'unknown') issueCodes.push('dialect_aggregate_unsupported');
      if (containsInlineQuery(call.argument)) issueCodes.push('aggregate_input_scalar_subquery');
      if (sourceIds.length > 1) issueCodes.push('aggregate_input_multi_relation');
      if (resolvedInput.ambiguous) issueCodes.push('aggregate_input_ambiguous');
      const status: PrerequisiteFactStatusV1 = issueCodes.some((code) => code.includes('unsupported') || code === 'aggregate_input_scalar_subquery') ? 'unsupported' : issueCodes.length ? 'ambiguous' : 'available';
      const distinct = isDistinctArgument(call.argument) ? 'distinct' : call.argument ? 'not_distinct' : 'unknown';
      return {
        distinct, groupingKeyIds: groupingKeys.map((key) => key.id), id: `aggregate:${String(outputIndex + 1).padStart(3, '0')}:${String(callIndex + 1).padStart(2, '0')}`,
        inputKind: inputKind(call.argument), inputReferenceIds, issueCodes: sortedUnique(issueCodes), operation, ownerNodeId: input.target.nodeId, ...(ownerScopeId ? { ownerScopeId } : {}), provenanceIds: sortedUnique(['parser-ast:submitted_statement', `lineage-node:${input.target.nodeId}`, ...(ownerScopeId ? [`lineage-scope:${ownerScopeId}`] : [])]), sourceIds, status,
        target: { columnName: item.identifier?.name ?? output?.name ?? `column_${outputIndex + 1}`, nodeId: input.target.nodeId, outputIndex },
      };
    });
  });
}

function observationContracts(aggregates: AggregateOperationFactV1[], groupingKeys: GroupingKeyFactV1[], sources: ProbePrerequisiteSourceV1[], issues: ProbePrerequisiteIssueV1[], candidateConcernIds: string[]): ProbeObservationContractV1[] {
  const contracts: ProbeObservationContractV1[] = [];
  const shared = { assumptions: ['The external evaluator observes the same query scope and source snapshot described by these static facts.'], concernIds: sortedUnique(candidateConcernIds), doesNotProve: ['A matching observation does not identify a root cause or prove that the original query is incorrect.'], inconclusiveWhen: ['Required facts are ambiguous or unsupported.', 'The observed shape does not match expected columns.', 'The observation snapshot is not comparable to the original incident.'] };
  for (const source of sources) {
    const available = source.status === 'resolved' && source.directness === 'direct';
    contracts.push({ ...shared, aggregateFactIds: [], blockedReasons: available ? [] : [source.status === 'resolved' ? 'observation_prerequisite_missing' : 'source_provenance_unreconstructable'], expectedColumns: [{ name: 'source_row_count', semanticType: 'count' }], groupingKeyIds: [], id: `observation:source-row-count:${source.id}`, kind: 'source_row_count', sourceIds: [source.id], status: available ? 'available' : 'blocked' });
  }
  const groupSourceIds = sortedUnique(groupingKeys.flatMap((fact) => fact.sourceIds));
  const groupAvailable = groupingKeys.length > 0 && groupingKeys.every((fact) => fact.status === 'available' && fact.referenceIds.length > 0 && fact.sourceIds.length > 0) && linkedSourcesAvailable(groupSourceIds, sources);
  const groupReasons = sortedUnique([...observationBlockedReasons(groupingKeys.map((fact) => fact.id), issues), ...linkedSourceBlockedReasons(groupSourceIds, sources)]);
  for (const [kind, column] of [['distinct_group_count', 'distinct_group_count'], ['rows_per_group', 'rows_per_group']] as const) {
    contracts.push({ ...shared, aggregateFactIds: [], blockedReasons: groupAvailable ? [] : groupReasons, expectedColumns: [{ name: column, semanticType: 'count' }], groupingKeyIds: groupingKeys.map((fact) => fact.id), id: `observation:${kind}`, kind, sourceIds: groupSourceIds, status: groupAvailable ? 'available' : 'blocked' });
  }
  for (const aggregate of aggregates) {
    const inputAvailable = aggregate.status === 'available' && aggregate.inputKind !== 'star' && aggregate.inputKind !== 'unknown' && aggregate.inputReferenceIds.length > 0 && aggregate.sourceIds.length === 1 && linkedSourcesAvailable(aggregate.sourceIds, sources);
    const reasons = sortedUnique([...observationBlockedReasons([aggregate.id], issues), ...linkedSourceBlockedReasons(aggregate.sourceIds, sources)]);
    for (const [kind, column, semanticType] of [['aggregate_input_non_null_count', 'aggregate_input_non_null_count', 'count'], ['aggregate_input_value_summary', 'aggregate_input_value_summary', 'summary']] as const) {
      contracts.push({ ...shared, aggregateFactIds: [aggregate.id], blockedReasons: inputAvailable ? [] : reasons, expectedColumns: [{ name: column, semanticType }], groupingKeyIds: [], id: `observation:${kind}:${aggregate.id}`, kind, sourceIds: aggregate.sourceIds, status: inputAvailable ? 'available' : 'blocked' });
    }
  }
  return contracts;
}

function observationBlockedReasons(factIds: string[], issues: ProbePrerequisiteIssueV1[]): PrerequisiteIssueCodeV1[] {
  const reasons = sortedUnique(issues.filter((issue) => issue.factIds.some((id) => factIds.includes(id))).map((issue) => issue.code));
  return reasons.length ? reasons : ['observation_prerequisite_missing'];
}

function linkedSourcesAvailable(sourceIds: string[], sources: ProbePrerequisiteSourceV1[]): boolean {
  return sourceIds.length > 0 && sourceIds.every((sourceId) => sources.some((source) => source.id === sourceId && source.status === 'resolved' && source.directness === 'direct'));
}

function linkedSourceBlockedReasons(sourceIds: string[], sources: ProbePrerequisiteSourceV1[]): PrerequisiteIssueCodeV1[] {
  const linked = sourceIds.map((sourceId) => sources.find((source) => source.id === sourceId));
  if (linked.some((source) => !source || source.status !== 'resolved' || source.directness === 'unknown')) return ['source_provenance_unreconstructable'];
  if (linked.some((source) => source?.directness !== 'direct')) return ['observation_prerequisite_missing'];
  return [];
}

function collectIssues(aggregates: AggregateOperationFactV1[], groupingKeys: GroupingKeyFactV1[], sources: ProbePrerequisiteSourceV1[]): ProbePrerequisiteIssueV1[] {
  const byCode = new Map<PrerequisiteIssueCodeV1, string[]>();
  for (const fact of [...aggregates, ...groupingKeys]) for (const code of fact.issueCodes) byCode.set(code, [...(byCode.get(code) ?? []), fact.id]);
  for (const source of sources.filter((source) => source.status === 'ambiguous')) byCode.set('source_provenance_unreconstructable', [...(byCode.get('source_provenance_unreconstructable') ?? []), source.id]);
  return [...byCode.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, factIds]) => ({ code, factIds, message: issueMessage(code), status: code.includes('unsupported') || code === 'aggregate_input_scalar_subquery' || code.startsWith('group_') ? 'blocked' : 'ambiguous' }));
}

function findFunctionCalls(value: unknown): FunctionCall[] {
  const found: FunctionCall[] = [];
  const seen = new Set<object>();
  const walk = (current: unknown): void => {
    if (!current || typeof current !== 'object' || seen.has(current as object) || current instanceof InlineQuery || current instanceof SubQuerySource) return;
    seen.add(current as object);
    if (current instanceof FunctionCall) found.push(current);
    for (const nested of Object.values(current as Record<string, unknown>)) Array.isArray(nested) ? nested.forEach(walk) : walk(nested);
  };
  walk(value);
  return found;
}
function containsInlineQuery(value: unknown): boolean { let found = false; visit(value, (item) => { if (item instanceof InlineQuery || item instanceof SubQuerySource) found = true; }); return found; }
function visit(value: unknown, callback: (value: unknown) => void, seen = new Set<object>()): void { if (!value || typeof value !== 'object' || seen.has(value as object)) return; seen.add(value as object); callback(value); for (const nested of Object.values(value as Record<string, unknown>)) { if (nested instanceof Map || nested instanceof Set) continue; if (Array.isArray(nested)) for (const item of nested) visit(item, callback, seen); else visit(nested, callback, seen); } }
function functionName(call: FunctionCall): string { return String((call.qualifiedName.name as { value?: string; name?: string }).value ?? (call.qualifiedName.name as { name?: string }).name ?? '').toLowerCase(); }
function looksAggregate(call: FunctionCall): boolean { return Boolean(call.over || call.withinGroup || call.filterCondition); }
function isDistinctArgument(value: unknown): boolean { return Boolean(value && typeof value === 'object' && 'operator' in value && String(((value as { operator?: { value?: unknown } }).operator?.value ?? '')).toLowerCase() === 'distinct'); }
function unwrapDistinct(value: unknown): unknown { return isDistinctArgument(value) ? (value as { expression?: unknown }).expression : value; }
function inputKind(value: unknown): AggregateOperationFactV1['inputKind'] { const unwrapped = unwrapDistinct(value); if (unwrapped instanceof ColumnReference) return unwrapped.column.name === '*' ? 'star' : 'column'; if (containsInlineQuery(unwrapped)) return 'scalar_subquery'; if (unwrapped instanceof CaseExpression) return 'case_expression'; return unwrapped ? 'composite_expression' : 'unknown'; }
function selectItemReferenceIds(outputIndex: number, input: Parameters<typeof buildProbePrerequisiteFactsV1>[0], references: ProbePrerequisiteReferenceV1[]): string[] { const owner = input.lineage.nodes.find((node) => node.id === input.target.nodeId); return matchReferences(references, owner?.columns.find((column) => column.outputIndex === outputIndex)?.upstream ?? []); }
function resolveAggregateArgumentReferences(value: unknown, outputUpstream: LineageColumnRef[], lineage: LineageModel, ownerNodeId: string, references: ProbePrerequisiteReferenceV1[]): { ambiguous: boolean; referenceIds: string[] } {
  const argument = unwrapDistinct(value);
  const astRefs = collectColumnReferences(argument, { skipInlineQueries: true }).filter((ref) => ref.column.name !== '*');
  if (astRefs.length === 0) return { ambiguous: false, referenceIds: [] };
  const resolved: LineageColumnRef[] = [];
  let ambiguous = false;
  for (const astRef of astRefs) {
    const namespace = astRef.getNamespace();
    const candidates = outputUpstream.filter((ref) => ref.columnName === astRef.column.name && (!namespace || lineage.edges.some((edge) => edge.target === ownerNodeId && edge.source === ref.nodeId && edge.sourceAlias === namespace)));
    const nodes = sortedUnique(candidates.map((candidate) => candidate.nodeId));
    if (nodes.length !== 1) { ambiguous = true; continue; }
    resolved.push(...candidates.filter((candidate) => candidate.nodeId === nodes[0]));
  }
  return { ambiguous, referenceIds: matchReferences(references, resolved) };
}
function matchReferences(all: ProbePrerequisiteReferenceV1[], refs: LineageColumnRef[]): string[] { return sortedUnique(refs.flatMap((ref) => all.filter((item) => item.nodeId === ref.nodeId && item.columnName === ref.columnName && (!ref.scopeId || item.scopeId === ref.scopeId)).map((item) => item.id))); }
function sourceIdsForReferences(sources: ProbePrerequisiteSourceV1[], references: ProbePrerequisiteReferenceV1[], ids: string[]): string[] { const nodes = new Set(references.filter((ref) => ids.includes(ref.id)).map((ref) => ref.nodeId)); return sources.filter((source) => nodes.has(source.nodeId)).map((source) => source.id); }
function applySourceRoles(sources: ProbePrerequisiteSourceV1[], aggregates: AggregateOperationFactV1[], groupingKeys: GroupingKeyFactV1[]): void { for (const source of sources) { if (aggregates.some((fact) => fact.sourceIds.includes(source.id))) source.roles.push('aggregate_input'); if (groupingKeys.some((fact) => fact.sourceIds.includes(source.id))) source.roles.push('grouping_key'); } }
function sourceKind(type: LineageNodeType): ProbePrerequisiteSourceV1['kind'] { return type === 'table' ? 'physical_table' : type === 'cte' ? 'cte' : type === 'derived' ? 'derived' : 'unknown'; }
function addProvenance(map: Map<string, ProbePrerequisiteFactsV1['provenance'][number]>, kind: ProbePrerequisiteFactsV1['provenance'][number]['kind'], sourceId: string): void { const id = `${kind.replace(/_/g, '-')}:${sourceId}`; map.set(id, { id, kind, sourceId }); }
function sortedUnique<T extends string>(values: T[]): T[] { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }
function sortById<T extends { id: string }>(values: T[], _unused?: unknown): T[] { return [...values].sort((a, b) => a.id.localeCompare(b.id)); }
function issueMessage(code: PrerequisiteIssueCodeV1): string { return ({ aggregate_input_ambiguous: 'Aggregate input references are ambiguous.', aggregate_input_multi_relation: 'Aggregate input spans multiple relations.', aggregate_input_scalar_subquery: 'Scalar-subquery aggregate input is not reconstructable as one source observation.', aggregate_operation_unsupported: 'Aggregate operation is unsupported.', aggregate_window_unsupported: 'Window aggregate observations are unsupported in version 1.', dialect_aggregate_unsupported: 'Dialect-specific aggregate semantics are unsupported.', group_alias_unresolved: 'GROUP BY alias cannot be resolved uniquely.', group_ordinal_unresolved: 'GROUP BY ordinal does not resolve to one select item.', observation_prerequisite_missing: 'A required static observation prerequisite is missing.', source_provenance_unreconstructable: 'Source provenance cannot be reconstructed.', target_scope_unavailable: 'The selected target query scope cannot be associated with parser-backed SQL.', wildcard_reference_ambiguous: 'Wildcard or unresolved reference is ambiguous.' } satisfies Record<PrerequisiteIssueCodeV1, string>)[code]; }
