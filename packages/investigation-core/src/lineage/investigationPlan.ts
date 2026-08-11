import { buildColumnDiagnosticPacket, type CandidateConcern, type ColumnDiagnosticPacket, type ColumnTarget } from './diagnostics';
import type { LineageModel, LineageNode } from '../domain/lineage';
import type { ProblemIntent } from './problemIntent';
import { analyzeSql } from './rawsqlAdapter';
import { parseSchemaFactsFromDdl, type DdlInput, type SchemaFacts } from './schemaFacts';
import { buildProbePrerequisiteFactsV1, type ProbePrerequisiteFactsV1 } from './probePrerequisiteFacts';
import {
  BinarySelectQuery,
  CTECollector,
  DeleteQuery,
  FunctionSource,
  InsertQuery,
  MergeQuery,
  ParameterExpression,
  ParenSource,
  SimpleSelectQuery,
  SqlParser,
  SubQuerySource,
  TableSource,
  UpdateQuery,
} from 'rawsql-ts';

/** The only SQL mode used to diagnose the submitted statement. */
export type InvestigationAnalysisModeV1 = 'original';

/**
 * Exhaustive SQL artifact roles supported by the version 1 public contract.
 * Rewrites use `equivalent_rewrite` only when an explicit rewrite artifact is emitted;
 * diagnostic statements are always `investigation_probe`, never corrected queries.
 */
export const sqlArtifactKinds = [
  'original_query',
  'equivalent_rewrite',
  'investigation_probe',
] as const;

export type SqlArtifactKindV1 = (typeof sqlArtifactKinds)[number];

export interface SqlArtifactV1<TKind extends SqlArtifactKindV1 = SqlArtifactKindV1> {
  artifactKind: TKind;
  sql: string;
}

export type InvestigationParameterOriginV1 =
  | 'investigation_key'
  | 'original_query_parameter'
  | 'derived_parameter'
  | 'environment_parameter'
  | 'unresolved_parameter';

/** Origins accepted from callers; unresolved parameters are planner-created only. */
export const investigationInputParameterOrigins = [
  'investigation_key',
  'original_query_parameter',
  'derived_parameter',
  'environment_parameter',
] as const satisfies readonly Exclude<InvestigationParameterOriginV1, 'unresolved_parameter'>[];

export type InvestigationInputParameterOriginV1 = (typeof investigationInputParameterOrigins)[number];

export type InvestigationParameterStatusV1 = 'provided' | 'required' | 'unresolved';

export type InvestigationParameterUseV1 =
  | { analysisMode: InvestigationAnalysisModeV1; kind: 'original_analysis' }
  | { kind: 'probe'; probeId: string };

export interface InvestigationParameterV1 {
  /** A deterministic identifier within the plan. */
  id: string;
  name: string;
  origin: InvestigationParameterOriginV1;
  required: boolean;
  status: InvestigationParameterStatusV1;
  typeHint?: string;
  usedBy: InvestigationParameterUseV1[];
}

export type UnresolvedParameterV1 = InvestigationParameterV1 & {
  origin: 'unresolved_parameter';
  status: 'unresolved';
};

export interface InvestigationTargetV1 {
  columnName: string;
  nodeId: string;
  symptom: string;
}

export interface CandidateConcernV1 {
  /** A deterministic identifier within the plan. */
  id: string;
  evidence: string[];
  hypothesis: string;
  limitations: string[];
  status: 'candidate';
}

export interface InvestigationDiagnosticV1 {
  code: string;
  message: string;
}

export interface InvestigationLimitationV1 {
  code: string;
  message: string;
}

/** Deterministic syntax evidence about a proposed probe; it never authorizes execution. */
export interface ProbeStaticSafetyEvidenceV1 {
  assumptions: string[];
  basis: 'parser_ast';
  confidence: 'syntax_only';
  executionCaveats: string[];
  statementClassification: 'select_statement';
  version: 1;
}

export type ProbeExpectedColumnRoleV1 = 'aggregate_count' | 'selected_node_output';
export type ProbeExpectedColumnTypeV1 = 'integer' | 'source_defined';

export interface ProbeExpectedColumnV1 {
  name?: string;
  role: ProbeExpectedColumnRoleV1;
  type: ProbeExpectedColumnTypeV1;
}

export type ProbeObservationConditionV1 =
  | 'candidate_rows_below_accepted_baseline'
  | 'candidate_rows_at_or_above_accepted_baseline'
  | 'comparable_baseline_unavailable_or_shape_invalid'
  | 'matching_rows_absent'
  | 'matching_rows_present'
  | 'required_parameter_unavailable_or_output_shape_invalid';

export interface ProbeObservationRuleV1 {
  candidateConcernIds: string[];
  condition: ProbeObservationConditionV1;
  outcome: 'inconclusive' | 'supports' | 'weakens';
}

/** Static instructions for an external evaluator; this object contains no observation. */
export interface ProbeInterpretationV1 {
  assumptions: string[];
  doesNotProve: string[];
  expectedCardinality: 'exactly_one_row' | 'zero_or_more_rows';
  expectedColumns: ProbeExpectedColumnV1[];
  inconclusiveHandling: {
    conditions: ProbeObservationConditionV1[];
    nextEvidence: string[];
  };
  nextEvidence: string[];
  observationRules: ProbeObservationRuleV1[];
  supportsCandidateConcernIds: string[];
  version: 1;
  weakensCandidateConcernIds: string[];
}

export interface ProbeSpecV1 extends SqlArtifactV1<'investigation_probe'> {
  /** A deterministic identifier within the plan. */
  id: string;
  confidence: 'high' | 'low' | 'medium' | 'possible' | 'unknown';
  hypothesis: string;
  interpretation: ProbeInterpretationV1;
  kind: string;
  limitations: string[];
  nodeId: string;
  parameters: InvestigationParameterV1[];
  priority: number;
  priorityReasons: string[];
  question: string;
  reason: string;
  staticSafetyEvidence: ProbeStaticSafetyEvidenceV1;
}

export interface BlockedProbeV1 {
  /** A deterministic identifier within the plan. */
  id: string;
  code: string;
  reason: string;
  status: 'blocked';
}

export interface NextEvidenceConditionFactV1 {
  candidateConcernIds: string[];
  influenceId: string;
  kind: string;
  mechanism: string;
  scopeId: string;
}

export interface NextEvidenceRelationFactV1 {
  conditionIds: string[];
  columnNames: string[];
  nodeId: string;
  relationName: string;
  scopeIds: string[];
}

export interface NextEvidencePropertyFactV1 {
  anchorRelationNodeIds: string[];
  conditionId: string;
  kind: 'matching_related_record' | 'no_matching_related_record';
  relatedRelationNodeIds: string[];
}

/** A static fact to verify after diagnosis; it never includes a new SQL statement or parameter value. */
export type NextEvidenceChecklistItemV1 =
  | { condition: NextEvidenceConditionFactV1; id: string; kind: 'condition'; status: 'to_verify' }
  | { id: string; kind: 'relation'; relation: NextEvidenceRelationFactV1; status: 'to_verify' }
  | { id: string; kind: 'property'; property: NextEvidencePropertyFactV1; status: 'to_verify' };

export interface InvestigationPlanV1 {
  analysisMode: InvestigationAnalysisModeV1;
  blockedProbes: BlockedProbeV1[];
  candidateConcerns: CandidateConcernV1[];
  deferredProbes: ProbeSpecV1[];
  diagnostics: InvestigationDiagnosticV1[];
  kind: 'investigation-plan';
  limitations: InvestigationLimitationV1[];
  /** Required in plan version 1; item provenance fields are additive within this field. */
  nextEvidenceChecklist: NextEvidenceChecklistItemV1[];
  /** The submitted statement, preserved and labeled without rewriting or execution. */
  originalQuery: SqlArtifactV1<'original_query'>;
  /** Parser/lineage-backed prerequisites only; this field never contains probe SQL or observations. */
  probePrerequisiteFacts?: ProbePrerequisiteFactsV1;
  parameters: InvestigationParameterV1[];
  recommendedProbes: ProbeSpecV1[];
  target: InvestigationTargetV1;
  unresolvedParameters: UnresolvedParameterV1[];
  version: 1;
}

/** Non-secret parameter metadata that may be emitted in an investigation plan. */
export interface InvestigationParameterDefinitionInputV1 {
  name: string;
  origin: InvestigationInputParameterOriginV1;
  required?: boolean;
  typeHint?: string;
}

/** Non-secret evidence that a separate caller-owned binding exists for a definition. */
export interface InvestigationParameterBindingPresenceV1 {
  providedNames: string[];
}

/** Planner input separates emit-safe definitions from binding-presence metadata. */
export interface InvestigationPlannerParametersV1 {
  bindingPresence?: InvestigationParameterBindingPresenceV1;
  definitions: InvestigationParameterDefinitionInputV1[];
}

/** Pure inputs to create an investigation plan from already-computed diagnostics. */
export interface InvestigationPlanInputV1 {
  /** Submitted SQL analyzed without rewriting or execution. */
  sql: string;
  target: ColumnTarget;
  symptom?: ProblemIntent;
  ddl?: DdlInput[];
  schemaFacts?: SchemaFacts;
  parameters?: InvestigationPlannerParametersV1;
}

/** Parser-backed node context used only to construct a syntax-classified outer-filter probe. */
export interface InvestigationNodeQueryContextV1 {
  analysisWarnings: LineageModel['analysisWarnings'];
  nodes: LineageNode[];
  scopes: LineageModel['scopes'];
}

/** A stable input error shared by the Planner's public entry points. */
export class InvestigationPlanInputError extends Error {
  readonly code: 'PARAMETER_BINDING_DEFINITION_MISMATCH' | 'PARAMETER_BINDING_INPUT_INVALID' | 'PARAMETER_NAME_COLLISION';

  constructor(code: InvestigationPlanInputError['code'] = 'PARAMETER_NAME_COLLISION') {
    super(code === 'PARAMETER_NAME_COLLISION'
      ? 'Parameter names must be unique across all supplied parameter definitions.'
      : code === 'PARAMETER_BINDING_DEFINITION_MISMATCH'
        ? 'Every supplied binding name must identify exactly one parameter definition.'
        : 'Concrete bindings must not be included in Core parameter definitions.');
    this.name = 'InvestigationPlanInputError';
    this.code = code;
  }
}

const SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]*(?:\.[A-Za-z_][A-Za-z0-9_$]*)*$/;
const MAX_RECOMMENDED_PROBES = 3;
/** Explicit, semantic ordering for equally-prioritized successful probes. */
const PROBE_KIND_RANK: Readonly<Record<string, number>> = {
  node_query_outer_filter: 0,
  candidate_row_count: 1,
};
/** Used when callers do not describe a symptom explicitly. */
const DEFAULT_INVESTIGATION_SYMPTOM: ProblemIntent = 'logic_review';

/**
 * Produces a deterministic, non-conclusive plan from static lineage diagnostics.
 * This function does not analyze altered SQL or execute a probe.
 */
export function createInvestigationPlan(input: InvestigationPlanInputV1): InvestigationPlanV1 {
  const parameters = normalizePlannerParameters(input.parameters);
  assertParameterInput(parameters);
  const schemaFacts = input.schemaFacts ?? (input.ddl ? parseSchemaFactsFromDdl(input.ddl) : undefined);
  const symptom = input.symptom ?? DEFAULT_INVESTIGATION_SYMPTOM;
  const { lineage } = analyzeSql(input.sql, { analysisMode: 'original', optimizeConditions: false, schemaFacts });
  const packet = buildColumnDiagnosticPacket(lineage, input.target, { schemaFacts, symptom });
  return {
    ...createInvestigationPlanFromDiagnosticPacket(packet, parameters, symptom, lineage),
    originalQuery: { artifactKind: 'original_query', sql: input.sql },
    probePrerequisiteFacts: buildProbePrerequisiteFactsV1({ candidateConcernIds: indexCandidateConcerns(packet.candidateConcerns).map((concern) => concern.id), lineage, parameters, schemaFacts, sql: input.sql, target: { ...input.target, symptom } }),
  };
}

/** @internal Test seam for planning behavior after the pure parser/diagnostics boundary. */
export function createInvestigationPlanFromDiagnosticPacket(
  packet: ColumnDiagnosticPacket,
  parameterInput: InvestigationPlannerParametersV1 = { definitions: [] },
  symptom: string = DEFAULT_INVESTIGATION_SYMPTOM,
  nodeQueryContext?: InvestigationNodeQueryContextV1,
): Omit<InvestigationPlanV1, 'originalQuery' | 'probePrerequisiteFacts'> {
  const inputs = normalizePlannerParameters(parameterInput);
  assertParameterInput(inputs);
  const indexedConcerns = indexCandidateConcerns(packet.candidateConcerns);
  const candidateConcerns = indexedConcerns.map(({ concern, id }) => toCandidateConcern(concern, id));
  const parameterEntries = buildParameters(inputs);
  const sourceByNodeId = new Map(packet.columnLineage.sourceLeaves.map((source) => [source.nodeId, source]));
  const successfulProbes: ProbeSpecV1[] = [];
  const blockedProbes: BlockedProbeV1[] = [];

  for (const indexedConcern of indexedConcerns) {
    const { concern } = indexedConcern;
    const probeId = `probe:${slug(concern.kind)}:${String(indexedConcern.index + 1).padStart(2, '0')}`;
    if (concern.kind !== 'where') {
      blockedProbes.push(blockedProbe(probeId, 'UNSUPPORTED_CONCERN_KIND', 'Only a single-relation WHERE predicate is supported for a standalone SELECT probe.'));
      continue;
    }
    const influence = resolveWhereInfluence(concern, packet);
    if (!influence) {
      blockedProbes.push(blockedProbe(probeId, 'SAFE_PROBE_FRAGMENT_UNAVAILABLE', 'No parser-backed WHERE predicate is available for a syntax-classified SELECT probe.'));
      continue;
    }
    if (new Set(influence.references.map((reference) => reference.nodeId)).size !== 1) {
      blockedProbes.push(blockedProbe(probeId, 'MULTI_RELATION_PREDICATE_UNSUPPORTED', 'The WHERE predicate references multiple relations and cannot be safely isolated as a standalone probe.'));
      continue;
    }
    if (hasQualifiedReference(influence.expressionSql)) {
      blockedProbes.push(blockedProbe(probeId, 'ALIAS_MAPPING_UNAVAILABLE', 'The WHERE predicate requires an original relation alias that cannot be reliably reconstructed for a standalone probe.'));
      continue;
    }
    const source = resolveProbeSource(concern, packet, sourceByNodeId);
    if (!source) {
      blockedProbes.push(blockedProbe(probeId, 'UNSUITABLE_PROBE_SOURCE', 'No supported physical source relation is available for a standalone SELECT probe.'));
      continue;
    }
    const probe = createProbe(probeId, indexedConcern.id, concern, source.relation, source.nodeId, influence.expressionSql, indexedConcern.index + 1, parameterEntries);
    if (!probe.probe) {
      blockedProbes.push(probe.blocked);
      continue;
    }
    successfulProbes.push(probe.probe);
  }

  const nodeQueryProbe = createNodeQueryOuterFilterProbe(packet, indexedConcerns, inputs.definitions, nodeQueryContext, parameterEntries);
  if (nodeQueryProbe.probe) {
    successfulProbes.push(nodeQueryProbe.probe);
  } else if (nodeQueryProbe.blocked) {
    blockedProbes.push(nodeQueryProbe.blocked);
  }

  const sortedProbes = successfulProbes.sort(compareProbes);
  const recommendedProbes = sortedProbes.slice(0, MAX_RECOMMENDED_PROBES);
  const deferredProbes = sortedProbes.slice(MAX_RECOMMENDED_PROBES);
  const parameters = [...parameterEntries.values()].sort((left, right) => left.id.localeCompare(right.id));
  const unresolvedParameters = parameters.filter(isUnresolvedParameter);
  return {
    analysisMode: 'original',
    blockedProbes,
    candidateConcerns,
    deferredProbes,
    diagnostics: [
      { code: 'original_sql_only', message: 'The plan uses only the original SQL lineage diagnostic packet.' },
      ...packet.diagnostics.map((diagnostic) => ({ code: diagnostic.code, message: diagnostic.message })),
    ],
    kind: 'investigation-plan',
    limitations: [
      { code: 'no_database_access', message: 'No database result was inspected; concerns remain hypotheses.' },
      { code: 'original_analysis_only', message: 'The planner does not rewrite or execute SQL.' },
      ...blockedProbes.map((probe) => ({ code: probe.code.toLowerCase(), message: probe.reason })),
    ],
    nextEvidenceChecklist: buildNextEvidenceChecklist(packet, indexedConcerns),
    parameters,
    recommendedProbes,
    target: { columnName: packet.target.columnName, nodeId: packet.target.nodeId, symptom },
    unresolvedParameters,
    version: 1,
  };
}

/**
 * Lists only diagnostic identities and references that a human can verify next.
 * It deliberately does not carry condition SQL, probe SQL, or supplied values.
 */
interface IndexedCandidateConcern {
  concern: CandidateConcern;
  id: string;
  index: number;
}

function indexCandidateConcerns(concerns: CandidateConcern[]): IndexedCandidateConcern[] {
  return concerns
    .map((concern, inputIndex) => ({ concern, inputIndex }))
    .sort((left, right) => compareConcerns(left.concern, right.concern) || left.inputIndex - right.inputIndex)
    .map(({ concern }, index) => ({ concern, id: `concern:${slug(concern.kind)}:${String(index + 1).padStart(2, '0')}`, index }));
}

function buildNextEvidenceChecklist(packet: ColumnDiagnosticPacket, indexedConcerns: IndexedCandidateConcern[]): NextEvidenceChecklistItemV1[] {
  const influenceById = new Map(packet.rowLineage.influences.map((influence) => [influence.id, influence]));
  const candidateConcernIdsByInfluenceId = new Map<string, string[]>();
  for (const { concern, id } of indexedConcerns) {
    for (const influenceId of concern.influenceIds) {
      candidateConcernIdsByInfluenceId.set(influenceId, [
        ...(candidateConcernIdsByInfluenceId.get(influenceId) ?? []),
        id,
      ]);
    }
  }
  for (const [influenceId, candidateConcernIds] of candidateConcernIdsByInfluenceId) {
    candidateConcernIdsByInfluenceId.set(influenceId, [...new Set(candidateConcernIds)].sort());
  }
  const influences = [...new Set(
    indexedConcerns
      .map(({ concern }) => concern)
      .flatMap((concern) => concern.influenceIds)
      .map((id) => influenceById.get(id))
      .filter((influence): influence is NonNullable<typeof influence> => influence !== undefined),
  )].sort((left, right) => `${left.scopeId}\u0000${left.kind}\u0000${left.mechanism}\u0000${left.id}`.localeCompare(`${right.scopeId}\u0000${right.kind}\u0000${right.mechanism}\u0000${right.id}`));

  const conditionIdByInfluenceId = new Map<string, string>();
  const conditionItems = influences.map((influence, index) => {
    const id = `next-evidence:condition:${String(index + 1).padStart(2, '0')}`;
    conditionIdByInfluenceId.set(influence.id, id);
    return {
      condition: {
        candidateConcernIds: candidateConcernIdsByInfluenceId.get(influence.id) ?? [],
        influenceId: influence.id,
        kind: influence.kind,
        mechanism: influence.mechanism,
        scopeId: influence.scopeId,
      },
      id,
      kind: 'condition' as const,
      status: 'to_verify' as const,
    };
  });

  const relationFacts = new Map<string, NextEvidenceRelationFactV1>();
  for (const influence of influences) {
    for (const reference of influence.references) {
      const existing = relationFacts.get(reference.nodeId);
      if (existing) {
        existing.conditionIds = [...new Set([
          ...existing.conditionIds,
          conditionIdByInfluenceId.get(influence.id)!,
        ])].sort();
        existing.columnNames = [...new Set([...existing.columnNames, reference.columnName])].sort();
        existing.scopeIds = [...new Set([...existing.scopeIds, reference.scopeId])].sort();
      } else {
        relationFacts.set(reference.nodeId, {
          conditionIds: [conditionIdByInfluenceId.get(influence.id)!],
          columnNames: [reference.columnName],
          nodeId: reference.nodeId,
          relationName: reference.nodeLabel,
          scopeIds: [reference.scopeId],
        });
      }
    }
  }
  const relationItems = [...relationFacts.values()]
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId) || left.relationName.localeCompare(right.relationName))
    .map((relation, index) => ({
      id: `next-evidence:relation:${String(index + 1).padStart(2, '0')}`,
      kind: 'relation' as const,
      relation,
      status: 'to_verify' as const,
    }));

  const propertyItems = influences
    .filter((influence) => influence.mechanism === 'exists' || influence.mechanism === 'not_exists')
    .map((influence, index) => ({
      id: `next-evidence:property:${String(index + 1).padStart(2, '0')}`,
      kind: 'property' as const,
      property: {
        conditionId: conditionIdByInfluenceId.get(influence.id)!,
        kind: influence.mechanism === 'exists' ? 'matching_related_record' as const : 'no_matching_related_record' as const,
        anchorRelationNodeIds: [...new Set(influence.references.filter((reference) => reference.provenance === 'anchor').map((reference) => reference.nodeId))].sort(),
        relatedRelationNodeIds: [...new Set(influence.references.filter((reference) => reference.provenance === 'related').map((reference) => reference.nodeId))].sort(),
      },
      status: 'to_verify' as const,
    }));

  return [...conditionItems, ...relationItems, ...propertyItems];
}

function createNodeQueryOuterFilterProbe(
  packet: ColumnDiagnosticPacket,
  indexedConcerns: IndexedCandidateConcern[],
  inputs: InvestigationParameterDefinitionInputV1[],
  context: InvestigationNodeQueryContextV1 | undefined,
  parameterEntries: Map<string, InvestigationParameterV1>,
): { blocked?: BlockedProbeV1; probe?: ProbeSpecV1 } {
  const investigationKeys = inputs.filter((input) => input.origin === 'investigation_key')
    .sort((left, right) => left.name.localeCompare(right.name));
  if (investigationKeys.length === 0) {
    return {};
  }
  if (new Set(investigationKeys.map((key) => key.name)).size !== investigationKeys.length) {
    return { blocked: blockedProbe('probe:node-query-outer-filter:01', 'INVESTIGATION_KEY_DUPLICATE', 'Each explicitly supplied investigation key name must be unique.') };
  }
  if (!context) {
    return { blocked: blockedProbe('probe:node-query-outer-filter:01', 'NODE_QUERY_UNAVAILABLE', 'No parser-backed node query context is available for the explicitly supplied investigation key.') };
  }
  const node = context.nodes.find((candidate) => candidate.id === packet.target.nodeId);
  if (!node?.querySql) {
    return { blocked: blockedProbe('probe:node-query-outer-filter:01', 'NODE_QUERY_UNAVAILABLE', 'The selected node has no standalone query SQL to wrap safely.') };
  }
  const candidateConcernIds = candidateConcernIdsForTargetNodeWhere(packet, context, indexedConcerns);
  if (candidateConcernIds.length === 0) {
    return {};
  }
  if (context.analysisWarnings.some((warning) => warning.code.includes('wildcard_unresolved'))) {
    return { blocked: blockedProbe('probe:node-query-outer-filter:01', 'UNRESOLVED_WILDCARD', 'The node output cannot be proven because wildcard output expansion is unresolved.') };
  }
  const outputKeys: string[] = [];
  for (const investigationKey of investigationKeys) {
    if (!isValidParameterName(investigationKey.name)) {
      return { blocked: blockedProbe('probe:node-query-outer-filter:01', 'INVESTIGATION_KEY_NOT_EXPOSED', 'Every explicitly supplied investigation key must be a valid SQL parameter identifier.') };
    }
    const matchingColumns = node.columns.filter((column) => column.name === investigationKey.name && column.outputIndex !== undefined);
    if (matchingColumns.length === 0) {
      return { blocked: blockedProbe('probe:node-query-outer-filter:01', 'INVESTIGATION_KEY_NOT_EXPOSED', 'Every explicitly supplied investigation key must be uniquely exposed by the selected node query.') };
    }
    if (matchingColumns.length !== 1) {
      return { blocked: blockedProbe('probe:node-query-outer-filter:01', 'AMBIGUOUS_OUTPUT_COLUMN', 'The selected node query exposes an investigation key more than once.') };
    }
    outputKeys.push(quoteIdentifier(matchingColumns[0].name));
  }
  const nodeQueryInspection = inspectStaticProbeStatement(node.querySql);
  if (nodeQueryInspection.ok === false) {
    return { blocked: blockedProbe('probe:node-query-outer-filter:01', nodeQueryInspection.code, nodeQueryInspection.reason) };
  }

  const id = 'probe:node-query-outer-filter:01';
  const conditions = investigationKeys.map((key, index) => `investigation_node.${outputKeys[index]} = :${key.name}`);
  const sql = `SELECT * FROM (\n${node.querySql}\n) AS investigation_node WHERE ${conditions.join(' AND ')}`;
  const generatedProbeInspection = inspectStaticProbeStatement(sql);
  if (generatedProbeInspection.ok === false) {
    return { blocked: blockedProbe(id, generatedProbeInspection.code, generatedProbeInspection.reason) };
  }
  const parameterNames = collectParameterNames(generatedProbeInspection.statement);
  const parameters = parameterNames.map((name) => ensureProbeParameter(name, id, parameterEntries));
  return {
    probe: {
      artifactKind: 'investigation_probe',
      confidence: 'possible',
      hypothesis: 'Filtering the selected node query by the explicitly supplied investigation key can isolate the relevant output rows without changing its internal SQL.',
      id,
      interpretation: createNodeQueryOuterFilterInterpretation(candidateConcernIds, node),
      kind: 'node_query_outer_filter',
      limitations: ['The original node query is preserved inside a derived-table wrapper.', 'The product did not run the proposed SELECT statement.', 'Parameter values are referenced by placeholders and are never inlined.'],
      nodeId: node.id,
      parameters,
      priority: 1,
      priorityReasons: ['The selected node query exposes the explicitly supplied investigation key exactly once.'],
      question: `Which selected-node rows match the supplied ${investigationKeys.map((key) => key.name).join(', ')} key values?`,
      reason: 'Wrap the proven standalone node query and apply the investigation key only in the outer filter.',
      sql,
      staticSafetyEvidence: createProbeStaticSafetyEvidence(),
    },
  };
}

function candidateConcernIdsForTargetNodeWhere(
  packet: ColumnDiagnosticPacket,
  context: InvestigationNodeQueryContextV1,
  indexedConcerns: IndexedCandidateConcern[],
): string[] {
  const scopeNodeById = new Map(context.scopes.map((scope) => [scope.id, scope.nodeId]));
  const influenceById = new Map(packet.rowLineage.influences.map((influence) => [influence.id, influence]));
  return indexedConcerns
    .filter(({ concern }) => concern.kind === 'where' && concern.influenceIds.some((id) => {
      const influence = influenceById.get(id);
      return influence?.kind === 'where' && scopeNodeById.get(influence.scopeId) === packet.target.nodeId;
    }))
    .map(({ id }) => id)
    .sort();
}

type StaticProbeStatementInspection =
  | { ok: true; statement: unknown }
  | { code: 'PROBE_REPARSE_FAILED' | 'PROBE_STATEMENT_CLASS_UNSUPPORTED'; ok: false; reason: string };

/**
 * Classifies one parseable SELECT statement whose complete CTE tree contains
 * only SELECT queries. This syntax check is not execution authorization.
 */
function inspectStaticProbeStatement(sql: string): StaticProbeStatementInspection {
  try {
    const statement = SqlParser.parse(sql);
    return isSupportedSelectTree(statement)
      ? { ok: true, statement }
      : {
        code: 'PROBE_STATEMENT_CLASS_UNSUPPORTED',
        ok: false,
        reason: 'The parsed probe is not within the supported static SELECT statement class.',
      };
  } catch {
    return {
      code: 'PROBE_REPARSE_FAILED',
      ok: false,
      reason: 'The probe SQL did not parse as one supported SELECT statement.',
    };
  }
}

/** Permits only public SELECT AST classes and recursively verifies every CTE body. */
function isSupportedSelectTree(query: unknown): boolean {
  if (query instanceof SimpleSelectQuery) {
    return (query.withClause?.tables ?? []).every((table) => isSupportedCteQuery(table.query))
      && isSupportedFromClause(query)
      && new CTECollector().collect(query).every((table) => isSupportedCteQuery(table.query));
  }
  if (query instanceof BinarySelectQuery) {
    return isSupportedSelectTree(query.left) && isSupportedSelectTree(query.right);
  }
  return false;
}

/** Verifies parser-backed derived-table query sources instead of treating them as opaque tables. */
function isSupportedFromClause(query: SimpleSelectQuery): boolean {
  const sources = query.fromClause?.getSources() ?? [];
  return sources.every((source) => isSupportedSelectSource(source.datasource));
}

function isSupportedSelectSource(source: unknown): boolean {
  if (source instanceof TableSource) return true;
  if (source instanceof SubQuerySource) return isSupportedSelectTree(source.query);
  if (source instanceof ParenSource) return isSupportedSelectSource(source.source);
  if (source instanceof FunctionSource) return true;
  return false;
}

function isSupportedCteQuery(query: unknown): boolean {
  if (query instanceof InsertQuery || query instanceof UpdateQuery || query instanceof DeleteQuery || query instanceof MergeQuery) {
    return false;
  }
  return isSupportedSelectTree(query);
}

function createProbeStaticSafetyEvidence(): ProbeStaticSafetyEvidenceV1 {
  return {
    assumptions: [
      'The SQL is interpreted by the parser version bundled with this product.',
      'The statement uses syntax supported by that parser.',
    ],
    basis: 'parser_ast',
    confidence: 'syntax_only',
    executionCaveats: [
      'This static classification does not authorize execution.',
      'No database, permissions, data, runtime bindings, or execution environment was inspected.',
      'SELECT syntax does not establish the absence of database-specific functions, locks, extensions, or user-defined effects.',
    ],
    statementClassification: 'select_statement',
    version: 1,
  };
}

function createCandidateRowCountInterpretation(candidateConcernId: string): ProbeInterpretationV1 {
  const candidateConcernIds = [candidateConcernId];
  const inconclusiveCondition: ProbeObservationConditionV1 = 'comparable_baseline_unavailable_or_shape_invalid';
  return {
    assumptions: [
      'An external investigator selects an accepted comparison baseline for the same source population and parameter context.',
      'The candidate_rows column is interpreted as one non-negative integer.',
    ],
    doesNotProve: [
      'A lower candidate row count does not prove that this candidate concern caused the reported symptom.',
      'A candidate row count at or above the baseline does not prove that this candidate concern is irrelevant in another runtime context.',
    ],
    expectedCardinality: 'exactly_one_row',
    expectedColumns: [{ name: 'candidate_rows', role: 'aggregate_count', type: 'integer' }],
    inconclusiveHandling: {
      conditions: [inconclusiveCondition],
      nextEvidence: ['Establish an authorized, comparable baseline before evaluating this count.'],
    },
    nextEvidence: ['Compare the candidate_rows count with an accepted baseline for the same population and parameter context.'],
    observationRules: [
      { candidateConcernIds, condition: 'candidate_rows_below_accepted_baseline', outcome: 'supports' },
      { candidateConcernIds, condition: 'candidate_rows_at_or_above_accepted_baseline', outcome: 'weakens' },
      { candidateConcernIds, condition: inconclusiveCondition, outcome: 'inconclusive' },
    ],
    supportsCandidateConcernIds: candidateConcernIds,
    version: 1,
    weakensCandidateConcernIds: candidateConcernIds,
  };
}

function createNodeQueryOuterFilterInterpretation(candidateConcernIdsInput: string[], node: LineageNode): ProbeInterpretationV1 {
  const candidateConcernIds = [...new Set(candidateConcernIdsInput)].sort();
  const knownColumns = node.columns
    .filter((column) => column.outputIndex !== undefined)
    .sort((left, right) => left.outputIndex! - right.outputIndex! || left.name.localeCompare(right.name))
    .map((column): ProbeExpectedColumnV1 => ({ name: column.name, role: 'selected_node_output', type: 'source_defined' }));
  const expectedColumns: ProbeExpectedColumnV1[] = knownColumns.length > 0
    ? knownColumns
    : [{ role: 'selected_node_output', type: 'source_defined' }];
  const inconclusiveCondition: ProbeObservationConditionV1 = 'required_parameter_unavailable_or_output_shape_invalid';
  return {
    assumptions: [
      'An external investigator supplies authorized bindings separately from this plan.',
      'The investigation key identifies the externally intended target population.',
      'Any evaluated rows correspond exactly to this probe SQL and its selected-node output shape.',
    ],
    doesNotProve: [
      'No matching row does not prove that any candidate concern caused the reported symptom.',
      'A matching row does not prove that the submitted query is correct or complete.',
    ],
    expectedCardinality: 'zero_or_more_rows',
    expectedColumns,
    inconclusiveHandling: {
      conditions: [inconclusiveCondition],
      nextEvidence: ['Resolve the expected output shape and required parameters before evaluating matching-row presence.'],
    },
    nextEvidence: ['Trace the same investigation key through the nearest upstream node when matching-row presence changes the candidate assessment.'],
    observationRules: [
      { candidateConcernIds, condition: 'matching_rows_absent', outcome: 'supports' },
      { candidateConcernIds, condition: 'matching_rows_present', outcome: 'weakens' },
      { candidateConcernIds, condition: inconclusiveCondition, outcome: 'inconclusive' },
    ],
    supportsCandidateConcernIds: candidateConcernIds,
    version: 1,
    weakensCandidateConcernIds: candidateConcernIds,
  };
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function isValidParameterName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function buildParameters(inputs: InvestigationPlannerParametersV1): Map<string, InvestigationParameterV1> {
  const result = new Map<string, InvestigationParameterV1>();
  const providedNames = new Set(inputs.bindingPresence?.providedNames ?? []);
  for (const input of [...inputs.definitions].sort((left, right) => `${left.origin}:${left.name}`.localeCompare(`${right.origin}:${right.name}`))) {
    const bindingProvided = providedNames.has(input.name);
    const origin = input.required && !bindingProvided ? 'unresolved_parameter' : input.origin;
    const id = `parameter:${origin}:${input.name}`;
    result.set(id, {
      id,
      name: input.name,
      origin,
      required: input.required ?? false,
      status: origin === 'unresolved_parameter' ? 'unresolved' : bindingProvided ? 'provided' : 'required',
      ...(input.typeHint ? { typeHint: input.typeHint } : {}),
      usedBy: input.origin === 'original_query_parameter' ? [{ analysisMode: 'original', kind: 'original_analysis' }] : [],
    });
  }
  return result;
}

function createProbe(
  id: string,
  candidateConcernId: string,
  concern: CandidateConcern,
  source: string,
  sourceNodeId: string,
  evidence: string,
  priority: number,
  parameterEntries: Map<string, InvestigationParameterV1>,
): { blocked: BlockedProbeV1; probe?: never } | { blocked?: never; probe: ProbeSpecV1 } {
  const sql = `SELECT COUNT(*) AS candidate_rows FROM ${source} WHERE (${evidence})`;
  const generatedProbeInspection = inspectStaticProbeStatement(sql);
  if (generatedProbeInspection.ok === false) {
    return { blocked: blockedProbe(id, generatedProbeInspection.code, generatedProbeInspection.reason) };
  }
  const parameterNames = collectParameterNames(generatedProbeInspection.statement);
  const parameters = parameterNames.map((name) => ensureProbeParameter(name, id, parameterEntries));
  return { probe: {
    artifactKind: 'investigation_probe',
    confidence: concern.confidence,
    hypothesis: `${concern.reason} This remains a candidate concern until the proposed probe is evaluated externally.`,
    id,
    interpretation: createCandidateRowCountInterpretation(candidateConcernId),
    kind: 'candidate_row_count',
    limitations: ['The product did not run the proposed SELECT statement.', 'Parameter values are referenced by placeholders and are never inlined.'],
    nodeId: sourceNodeId,
    parameters,
    priority,
    priorityReasons: ['Directly tests static SQL evidence for a candidate concern.'],
    question: `How many rows in ${source} satisfy the candidate condition?`,
    reason: concern.reason,
    sql,
    staticSafetyEvidence: createProbeStaticSafetyEvidence(),
  } };
}

function ensureProbeParameter(name: string, probeId: string, entries: Map<string, InvestigationParameterV1>): InvestigationParameterV1 {
  const entry = [...entries.values()].find((parameter) => parameter.name === name)
    ?? createUnresolvedParameter(name, entries);
  if (!entry.usedBy.some((use) => use.kind === 'probe' && use.probeId === probeId)) {
    entry.usedBy.push({ kind: 'probe', probeId });
  }
  return entry;
}

function createUnresolvedParameter(name: string, entries: Map<string, InvestigationParameterV1>): InvestigationParameterV1 {
  const id = `parameter:unresolved_parameter:${name}`;
  const parameter: InvestigationParameterV1 = { id, name, origin: 'unresolved_parameter', required: true, status: 'unresolved', usedBy: [] };
  entries.set(id, parameter);
  return parameter;
}

function resolveProbeSource(
  concern: CandidateConcern,
  packet: ColumnDiagnosticPacket,
  sourceByNodeId: Map<string, ColumnDiagnosticPacket['columnLineage']['sourceLeaves'][number]>,
): { nodeId: string; relation: string } | undefined {
  const referenceNodeId = concern.influenceIds.length > 0
    ? packet.rowLineage.influences.find((influence) => influence.id === concern.influenceIds[0])?.references[0]?.nodeId
    : undefined;
  const source = referenceNodeId ? sourceByNodeId.get(referenceNodeId) : packet.columnLineage.sourceLeaves[0];
  const value = source?.nodeLabel;
  return value && source?.nodeType === 'table' && SQL_IDENTIFIER.test(value) ? { nodeId: source.nodeId, relation: value } : undefined;
}

function resolveWhereInfluence(concern: CandidateConcern, packet: ColumnDiagnosticPacket): { expressionSql: string; references: Array<{ nodeId: string }> } | undefined {
  const influences = new Map(packet.rowLineage.influences.map((influence) => [influence.id, influence]));
  for (const id of concern.influenceIds) {
    const influence = influences.get(id);
    if (influence?.kind === 'where' && typeof influence.expressionSql === 'string' && isSafePredicate(influence.expressionSql)) {
      return { expressionSql: influence.expressionSql, references: influence.references };
    }
  }
  return undefined;
}

function toCandidateConcern(concern: CandidateConcern, id: string): CandidateConcernV1 {
  return {
    evidence: [...concern.evidence],
    hypothesis: `${concern.reason} This is a candidate concern, not a conclusion.`,
    id,
    limitations: ['No database result was inspected.'],
    status: 'candidate',
  };
}

function compareConcerns(left: CandidateConcern, right: CandidateConcern): number {
  return concernSortKey(left).localeCompare(concernSortKey(right));
}

function concernSortKey(concern: CandidateConcern): string {
  return JSON.stringify([
    concern.kind,
    concern.scopeId,
    concern.confidence,
    concern.checkDomains,
    concern.effects,
    concern.evidence,
    concern.impact,
    concern.influenceIds,
    concern.mechanisms,
    concern.reason,
    concern.signals,
    concern.symptomMatch,
  ]);
}

/** Sorts all successful probes before the recommendation split: priority, kind, node, then id. */
function compareProbes(left: ProbeSpecV1, right: ProbeSpecV1): number {
  return left.priority - right.priority
    || (PROBE_KIND_RANK[left.kind] ?? Number.MAX_SAFE_INTEGER) - (PROBE_KIND_RANK[right.kind] ?? Number.MAX_SAFE_INTEGER)
    || left.nodeId.localeCompare(right.nodeId)
    || left.id.localeCompare(right.id);
}

function collectParameterNames(statement: unknown): string[] {
  const names = new Set<string>();
  const seen = new Set<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value instanceof ParameterExpression) {
      names.add(value.name.value);
      return;
    }
    for (const nested of Object.values(value)) {
      if (Array.isArray(nested)) nested.forEach(visit);
      else visit(nested);
    }
  };
  visit(statement);
  return [...names].sort();
}

function normalizePlannerParameters(input: InvestigationPlannerParametersV1 | undefined): InvestigationPlannerParametersV1 {
  return input ?? { definitions: [] };
}

function assertParameterInput(input: InvestigationPlannerParametersV1): void {
  if (Object.prototype.hasOwnProperty.call(input, 'bindings') || input.definitions.some((definition) => Object.prototype.hasOwnProperty.call(definition, 'value'))) {
    throw new InvestigationPlanInputError('PARAMETER_BINDING_INPUT_INVALID');
  }
  assertUniqueParameterNames(input.definitions);
  const definitionNames = new Set(input.definitions.map((definition) => definition.name));
  const providedNames = input.bindingPresence?.providedNames ?? [];
  if (new Set(providedNames).size !== providedNames.length || providedNames.some((name) => !definitionNames.has(name))) {
    throw new InvestigationPlanInputError('PARAMETER_BINDING_DEFINITION_MISMATCH');
  }
}

function assertUniqueParameterNames(inputs: InvestigationParameterDefinitionInputV1[]): void {
  const names = new Set<string>();
  for (const input of inputs) {
    if (names.has(input.name)) throw new InvestigationPlanInputError();
    names.add(input.name);
  }
}

function isSafePredicate(sql: string): boolean {
  return sql.trim().length > 0
    && !/[;]|--|\/\*/.test(sql)
    && !/(?:=|<>|!=|<=|>=|<|>|\+|-|\*|\/|\b(?:and|or|not|is|in|like|between))\s*$/i.test(sql);
}

function hasQualifiedReference(sql: string): boolean {
  return /\b[A-Za-z_][A-Za-z0-9_$]*\s*\./.test(sql);
}

function blockedProbe(id: string, code: string, reason: string): BlockedProbeV1 {
  return { code, id, reason, status: 'blocked' };
}

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'unknown';
}

function isUnresolvedParameter(parameter: InvestigationParameterV1): parameter is UnresolvedParameterV1 {
  return parameter.origin === 'unresolved_parameter' && parameter.status === 'unresolved';
}
