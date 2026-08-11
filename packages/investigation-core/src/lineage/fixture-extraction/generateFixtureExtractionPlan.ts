import {
  BinaryExpression,
  BinarySelectQuery,
  ColumnReference,
  InlineQuery,
  JoinClause,
  JoinOnClause,
  LiteralValue,
  ParameterExpression,
  ParenExpression,
  ParenSource,
  SimpleSelectQuery,
  SqlParser,
  SubQuerySource,
  TableSource,
  UnaryExpression,
} from 'rawsql-ts';
import type { SourceExpression } from 'rawsql-ts';
import { analyzeSql } from '../rawsqlAdapter';
import {
  parseSchemaFactsFromDdl,
  type SchemaDeclaredLogicalForeignKeyFacts,
  type SchemaFacts,
  type SchemaFactsDiagnostic,
  type SchemaForeignKeyFacts,
  type SchemaTableFacts,
} from '../schemaFacts';
import {
  compareCodeUnits,
  FIXTURE_EXTRACTION_PLAN_SCHEMA_VERSION,
  FixtureExtractionInputError,
  type FixtureExtractionBlockedCode,
  type FixtureExtractionBlockedReason,
  type FixtureExtractionBoundedStep,
  type FixtureExtractionCaptureColumns,
  type FixtureExtractionColumnParameterMapping,
  type FixtureExtractionInput,
  type FixtureExtractionLimitationCode,
  type FixtureExtractionLimitation,
  type FixtureExtractionPlan,
  type FixtureExtractionPredicateDerivation,
  type FixtureExtractionReproductionKey,
  type FixtureExtractionRequiredFact,
  type FixtureExtractionResultExpectation,
  type FixtureExtractionSourceEvidenceKind,
  type FixtureExtractionSourceEvidence,
  type FixtureExtractionStep,
  type FixtureExtractionUnknownStep,
} from './fixtureExtractionPlan';
import { inspectStaticSelectSafety, type StaticSelectSafetyBlocker } from './staticSelectSafety';
import { sha256Hex } from '../sha256';

interface EvidenceDraft {
  key: string;
  kind: FixtureExtractionSourceEvidenceKind;
  sourceId: string;
  sourcePath?: string;
}

interface ParameterEquality {
  column: string;
  evidencePath: string;
  kind: 'join' | 'where';
  parameter: string;
}

interface StaticEquality {
  column: string;
  evidencePath: string;
  literalSql: string;
}

interface Occurrence {
  alias: string;
  caseSensitiveIdentityUnproven: boolean;
  occurrenceId: string;
  parameterEqualities: ParameterEquality[];
  path: string;
  populationParameterEqualities: ParameterEquality[];
  populationStaticEqualities: StaticEquality[];
  relationName: string;
  tableResolution?: 'ambiguous' | 'missing' | 'resolved';
  table?: SchemaTableFacts;
  unsafePopulationPredicate: boolean;
}

interface EqualityPair {
  left: { column: string; occurrence: Occurrence };
  right: { column: string; occurrence: Occurrence };
}

interface OccurrenceEdge {
  anchor: Occurrence;
  equalityPairs: EqualityPair[];
  evidencePath: string;
  joinType: string;
  kind: 'exists' | 'join';
  localParameterEqualities: ParameterEquality[];
  localStaticEqualities: StaticEquality[];
  notExists: boolean;
  related: Occurrence;
  unsafePredicate: boolean;
}

interface OccurrenceGraph {
  edges: OccurrenceEdge[];
  hasRecursiveCte: boolean;
  hasSetOperation: boolean;
  occurrences: Occurrence[];
}

interface PropagatedConstraint {
  kind: 'parameter' | 'static';
  value: string;
}

interface BoundedDraft {
  boundaryReason: FixtureExtractionBoundedStep['boundary']['reason'];
  boundaryRelationColumns: string[];
  dependsOn?: Occurrence;
  derivation: FixtureExtractionPredicateDerivation;
  evidenceKeys: string[];
  hop: number;
  loadAfter?: Occurrence;
  occurrence: Occurrence;
  parameterNames: string[];
  constraintsByColumn: Map<string, PropagatedConstraint[]>;
  predicateSql: string;
  resultExpectation: FixtureExtractionResultExpectation;
  relationPath: string[];
  sql: string;
}

interface UnknownDraft {
  attemptedHopCount: number;
  dependsOn?: Occurrence;
  derivation: FixtureExtractionPredicateDerivation;
  evidenceKeys: string[];
  occurrence: Occurrence;
  parameterNames: string[];
  reasonCodes: FixtureExtractionBlockedCode[];
}

type StepDraft = BoundedDraft | UnknownDraft;

interface RelationshipCandidate {
  readonly facts: SchemaForeignKeyFacts | SchemaDeclaredLogicalForeignKeyFacts;
  readonly kind: 'physical_foreign_key' | 'declared_logical_foreign_key';
}

interface BlockedReasonDraft {
  affectedOccurrence?: Occurrence;
  code: FixtureExtractionBlockedCode;
  evidenceKeys: string[];
}

interface StrictSchemaIndex {
  byBase: Map<string, SchemaTableFacts[]>;
  byQualified: Map<string, SchemaTableFacts>;
}

const FORBIDDEN_INPUT_KEYS = new Set(['binding', 'bindings', 'bindingValue', 'bindingValues', 'value', 'values', 'providedValues']);
const PARAMETER_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_RELATION_OCCURRENCES = 256;

const BLOCKED_CATALOG: Record<FixtureExtractionBlockedCode, {
  message: string;
  rank: number;
  requiredFacts: readonly FixtureExtractionRequiredFact[];
}> = {
  SQL_PARSE_UNSUPPORTED: { rank: 1, requiredFacts: ['static SQL text'], message: 'The submitted statement cannot be classified by the supported parser-backed SELECT policy.' },
  DML_STATEMENT_UNSUPPORTED: { rank: 2, requiredFacts: [], message: 'Top-level data modification is unsupported for fixture extraction.' },
  RETURNING_UNSUPPORTED: { rank: 3, requiredFacts: [], message: 'RETURNING is unsupported for fixture extraction.' },
  DML_CTE_UNSUPPORTED: { rank: 4, requiredFacts: [], message: 'A data-modifying CTE or derived query is unsupported for fixture extraction.' },
  RECURSIVE_CTE_UNSUPPORTED: { rank: 5, requiredFacts: [], message: 'Recursive query dependencies are unsupported for fixture extraction.' },
  ENVIRONMENT_STATE_UNSUPPORTED: { rank: 6, requiredFacts: ['transaction-independent semantics'], message: 'Environment-dependent state cannot be reproduced by a static fixture extraction plan.' },
  VOLATILE_SOURCE_UNSUPPORTED: { rank: 7, requiredFacts: ['function volatility metadata'], message: 'Volatile or unclassified function sources are unsupported.' },
  ANALYSIS_RESOURCE_LIMIT: { rank: 8, requiredFacts: [], message: 'The submitted relation graph exceeds the fixture-planner operational resource limit.' },
  UNRESOLVED_WILDCARD: { rank: 9, requiredFacts: ['schema columns'], message: 'A required wildcard cannot be resolved from static schema evidence.' },
  ROOT_RELATION_UNRESOLVED: { rank: 10, requiredFacts: ['relation identity'], message: 'The reproduction-key root relation cannot be resolved uniquely.' },
  RELATION_UNRESOLVED: { rank: 11, requiredFacts: ['relation identity'], message: 'A required physical relation cannot be resolved uniquely.' },
  COLUMN_REFERENCE_AMBIGUOUS: { rank: 12, requiredFacts: ['relation identity', 'schema columns'], message: 'A required predicate column cannot be resolved uniquely.' },
  REPRODUCTION_KEY_REQUIRED: { rank: 13, requiredFacts: ['static SQL text'], message: 'A parameterized WHERE search condition is required to bound fixture extraction.' },
  REPRODUCTION_KEY_AMBIGUOUS: { rank: 14, requiredFacts: ['root key column', 'relation identity'], message: 'The reproduction key cannot be mapped to one proven root predicate.' },
  SCHEMA_FACTS_REQUIRED: { rank: 15, requiredFacts: ['missing foreign key', 'root key column'], message: 'Additional static schema facts are required to prove the capture boundary.' },
  FOREIGN_KEY_AMBIGUOUS: { rank: 16, requiredFacts: ['missing foreign key', 'relation identity'], message: 'The foreign-key dependency cannot be resolved to one ordered mapping.' },
  RELATIONSHIP_CYCLE_UNSUPPORTED: { rank: 17, requiredFacts: [], message: 'A relationship path repeats a relation and cannot be expanded safely.' },
  NON_EQUALITY_JOIN_UNSUPPORTED: { rank: 18, requiredFacts: [], message: 'The required join predicate is not a supported column equality.' },
  JOIN_BOUNDARY_UNPROVEN: { rank: 19, requiredFacts: ['missing foreign key'], message: 'The join does not prove a safe fixture row boundary.' },
  PARAMETER_PROPAGATION_UNPROVEN: { rank: 20, requiredFacts: ['missing foreign key', 'root key column'], message: 'Reproduction parameters cannot be propagated to a required relation.' },
  CAPTURE_BOUNDARY_UNBOUNDED: { rank: 21, requiredFacts: ['missing foreign key', 'root key column'], message: 'A required capture query would be unbounded.' },
};

const LIMITATION_CATALOG: Record<FixtureExtractionLimitationCode, { message: string; rank: number }> = {
  STATIC_ONLY_NO_EXECUTION: { rank: 1, message: 'This plan is static and did not execute SQL or inspect data.' },
  SENSITIVE_COLUMN_POLICY_NOT_EVALUATED: { rank: 2, message: 'Sensitive column policy was not evaluated.' },
  GENERATED_IDENTITY_LOADING_OUTSIDE_POC: { rank: 3, message: 'Generated and identity column loading is outside the PoC.' },
  LARGE_OBJECT_MIGRATION_OUTSIDE_POC: { rank: 4, message: 'Large object migration is outside the PoC.' },
  PARTIAL_PLAN_INCOMPLETE: { rank: 5, message: 'This partial plan is not a complete reproduction fixture.' },
  ROOT_PREDICATE_MAY_CAPTURE_MULTIPLE_ROWS: { rank: 6, message: 'The root parameter predicate is not a primary or unique key and may capture multiple rows.' },
};

const EVIDENCE_KIND_RANK: Record<FixtureExtractionSourceEvidenceKind, number> = {
  parser_ast: 1,
  lineage_node: 2,
  lineage_edge: 3,
  lineage_scope: 4,
  where_condition: 5,
  join_condition: 6,
  exists_condition: 7,
  schema_table: 8,
  schema_primary_key: 9,
  schema_unique_key: 10,
  schema_foreign_key: 11,
  schema_declared_logical_foreign_key: 12,
  schema_diagnostic: 13,
};

/** Builds a pure, internal, fail-closed  fixture-capture SELECT plan. */
export function generateFixtureExtractionPlan(input: FixtureExtractionInput): FixtureExtractionPlan {
  assertInput(input);
  const sqlHash = `sha256:${sha256Hex(input.sql)}`;
  const source = {
    analysisMode: 'original' as const,
    hashAlgorithm: 'sha256' as const,
    sqlHash,
  };
  const safety = inspectStaticSelectSafety(input.sql);
  if (!safety.ok) return globalBlockedPlan(input, source, safety.blockers);
  if (collectParameterNamesFromAst(safety.statement).some((parameter) => !PARAMETER_NAME.test(parameter))) {
    return blockedBeforeRoot(input, source, 'PARAMETER_PROPAGATION_UNPROVEN', 'blocked', [{
      kind: 'parser_ast',
      sourceId: 'parameter:unsupported-spelling',
      sourcePath: 'statement.parameter',
    }]);
  }

  const graph = collectOccurrenceGraph(safety.statement);
  if (graph.hasRecursiveCte) {
    return blockedBeforeRoot(input, source, 'RECURSIVE_CTE_UNSUPPORTED', 'blocked', [{
      kind: 'parser_ast',
      sourceId: 'query:recursive-cte-dependency',
      sourcePath: 'statement.with',
    }]);
  }

  const schemaFacts = input.schemaFacts ?? (input.ddl ? parseSchemaFactsFromDdl([...input.ddl]) : undefined);
  try {
    analyzeSql(input.sql, { analysisMode: 'original', optimizeConditions: false, schemaFacts });
  } catch {
    const code: FixtureExtractionBlockedCode = hasWildcard(safety.statement) ? 'UNRESOLVED_WILDCARD' : 'COLUMN_REFERENCE_AMBIGUOUS';
    return blockedBeforeRoot(input, source, code, 'blocked', [{ kind: 'parser_ast', sourceId: 'select:unsupported', sourcePath: 'statement.select' }]);
  }

  if (hasWildcard(safety.statement) && !schemaFacts) {
    return blockedBeforeRoot(input, source, 'UNRESOLVED_WILDCARD', 'blocked', [{ kind: 'parser_ast', sourceId: 'select:wildcard', sourcePath: 'statement.select' }]);
  }
  if (hasUnsupportedInlineQuery(safety.statement)) {
    return blockedBeforeRoot(input, source, 'PARAMETER_PROPAGATION_UNPROVEN', 'blocked', [{
      kind: 'parser_ast',
      sourceId: 'query:inline-unsupported',
      sourcePath: 'statement.inline-query',
    }]);
  }

  if (graph.occurrences.length > MAX_RELATION_OCCURRENCES) {
    return blockedBeforeRoot(input, source, 'ANALYSIS_RESOURCE_LIMIT', 'blocked', [{
      kind: 'parser_ast',
      sourceId: 'relation-occurrences:limit',
      sourcePath: 'statement.from',
    }]);
  }
  if (graph.hasSetOperation) {
    return blockedBeforeRoot(input, source, 'PARAMETER_PROPAGATION_UNPROVEN', 'blocked', [{
      kind: 'parser_ast',
      sourceId: 'query:set-operation',
      sourcePath: 'statement.set-operation',
    }]);
  }
  assignOccurrenceIds(graph.occurrences);
  const schemaIndex = createStrictSchemaIndex(schemaFacts);
  graph.occurrences.forEach((occurrence) => {
    const resolution = resolveStrictTable(schemaIndex, occurrence.relationName);
    occurrence.table = resolution.table;
    occurrence.tableResolution = resolution.status;
  });
  const malformedSchemaOccurrence = graph.occurrences.find((occurrence) => occurrence.table
    && !hasTableCrossFieldIntegrity(occurrence.table, schemaIndex));
  if (malformedSchemaOccurrence) {
    return blockedBeforeRoot(input, source, 'SCHEMA_FACTS_REQUIRED', 'blocked', [{
      kind: 'schema_table',
      sourceId: `${malformedSchemaOccurrence.path}:schema-cross-field`,
      sourcePath: `${malformedSchemaOccurrence.path}.schema-table`,
    }]);
  }
  const blockingDiagnostics = findBlockingSchemaDiagnostics(schemaFacts);
  if (blockingDiagnostics.length > 0) {
    return blockedBeforeRoot(input, source, 'SCHEMA_FACTS_REQUIRED', 'blocked', blockingDiagnostics.map((diagnostic, index) => ({
      kind: 'schema_diagnostic',
      sourceId: `schema-diagnostic:${String(index + 1).padStart(4, '0')}:${diagnostic.code}`,
      sourcePath: `schemaFacts.diagnostics.canonical[${String(index).padStart(4, '0')}]`,
    })));
  }
  const caseAmbiguousRelation = graph.occurrences.find((occurrence) => occurrence.caseSensitiveIdentityUnproven);
  if (caseAmbiguousRelation) {
    const isRoot = input.reproductionKey?.rootRelation
      ? relationMatches(input.reproductionKey.rootRelation, caseAmbiguousRelation.relationName)
      : false;
    return blockedBeforeRoot(input, source, isRoot ? 'ROOT_RELATION_UNRESOLVED' : 'RELATION_UNRESOLVED', 'ambiguous', [{
      kind: 'parser_ast',
      sourceId: `${caseAmbiguousRelation.path}:case-sensitive-relation`,
      sourcePath: caseAmbiguousRelation.path,
    }]);
  }
  const caseAmbiguousColumn = graph.occurrences.find((occurrence) => occurrence.table
    && Object.values(occurrence.table.columns).some((column) => column.name !== column.name.toLowerCase()));
  if (caseAmbiguousColumn) {
    return blockedBeforeRoot(input, source, 'COLUMN_REFERENCE_AMBIGUOUS', 'ambiguous', [{
      kind: 'schema_table',
      sourceId: `${caseAmbiguousColumn.relationName}:case-sensitive-column`,
      sourcePath: `${caseAmbiguousColumn.path}.schema-table`,
    }]);
  }

  const rootResult = resolveRoot(input, graph.occurrences, schemaIndex);
  if (!rootResult.ok) {
    return blockedBeforeRoot(input, source, rootResult.codes[0], rootResult.status, [], rootResult.codes.slice(1));
  }

  const evidence = new EvidenceRegistry();
  const root = rootResult.root;
  const rootEvidenceKeys = createRootEvidence(evidence, root, rootResult.keyKind, rootResult.rootEquality.evidencePath);
  rootResult.mappings.forEach((mapping) => addOccurrenceParameterEquality(root, {
    column: mapping.rootColumn,
    evidencePath: rootResult.rootEquality.evidencePath,
    kind: 'where',
    parameter: mapping.parameterName,
  }));
  const rootParameters = [...root.populationParameterEqualities]
    .sort((left, right) => compareCodeUnits(left.column, right.column) || compareCodeUnits(left.parameter, right.parameter));
  const rootStatics = [...root.populationStaticEqualities]
    .sort((left, right) => compareCodeUnits(left.column, right.column) || compareCodeUnits(left.literalSql, right.literalSql));
  if (rootParameters.some((item) => (root.table && !tableHasColumn(root.table, item.column)) || !PARAMETER_NAME.test(item.parameter))
    || rootStatics.some((item) => root.table && !tableHasColumn(root.table, item.column))) {
    return blockedBeforeRoot(input, source, 'SCHEMA_FACTS_REQUIRED', 'blocked', []);
  }
  const rootPredicate = [
    ...rootParameters.map((item) => `${quoteIdentifier(item.column)} = :${item.parameter}`),
    ...rootStatics.map((item) => `${quoteIdentifier(item.column)} = ${item.literalSql}`),
  ].join(' and ');
  const rootConstraintsByColumn = new Map<string, PropagatedConstraint[]>();
  rootParameters.forEach((item) => addPropagatedConstraint(rootConstraintsByColumn, item.column, { kind: 'parameter', value: item.parameter }));
  rootStatics.forEach((item) => addPropagatedConstraint(rootConstraintsByColumn, item.column, { kind: 'static', value: item.literalSql }));
  const rootParameterNames = collectParameterNamesFromSql(`select * from ${quoteRelation(root.relationName)} where ${rootPredicate};`);
  const rootDraft: BoundedDraft = {
    boundaryReason: rootResult.boundaryKind === 'key_equality' ? 'root_key_parameter_equality' : 'root_parameter_predicate',
    boundaryRelationColumns: [...rootParameters.map((item) => item.column), ...rootStatics.map((item) => item.column)].sort(compareCodeUnits),
    derivation: 'root_predicate',
    evidenceKeys: rootEvidenceKeys,
    hop: 0,
    occurrence: root,
    constraintsByColumn: rootConstraintsByColumn,
    parameterNames: rootParameterNames,
    predicateSql: rootPredicate,
    relationPath: [normalizeIdentifier(root.relationName)],
    resultExpectation: rowsMayBePresent(),
    sql: buildDirectSelect(root, rootPredicate),
  };

  const drafts = deriveSteps(graph, rootDraft, evidence);
  const finalized = finalizeSteps(drafts, evidence);
  const unknowns = finalized.steps.filter((step): step is FixtureExtractionUnknownStep => step.sql === null);
  const status = unknowns.length > 0 || graph.hasSetOperation || rootResult.partialCodes?.length ? 'partial' : 'ready';
  const blockedReasonDrafts = drafts.flatMap((draft): BlockedReasonDraft[] => isUnknownDraft(draft)
    ? draft.reasonCodes.map((code) => ({ affectedOccurrence: draft.occurrence, code, evidenceKeys: draft.evidenceKeys }))
    : []);
  if (graph.hasSetOperation && blockedReasonDrafts.length === 0) {
    blockedReasonDrafts.push({ code: 'PARAMETER_PROPAGATION_UNPROVEN', evidenceKeys: rootEvidenceKeys });
  }
  (rootResult.partialCodes ?? []).forEach((code) => blockedReasonDrafts.push({ code, evidenceKeys: rootEvidenceKeys }));

  const blockedReasons = finalizeBlockedReasons(blockedReasonDrafts, finalized.stepIdByOccurrence, evidence);
  const reproductionKey: FixtureExtractionReproductionKey = {
    boundaryKind: rootResult.boundaryKind,
    parameterNames: [...new Set(rootResult.mappings.map((mapping) => mapping.parameterName))].sort(compareCodeUnits),
    rootRelation: root.relationName,
    rootRelationOccurrenceId: root.occurrenceId,
    rootColumns: [...new Set(rootResult.mappings.map((mapping) => mapping.rootColumn))].sort(compareCodeUnits),
    columnParameterMappings: [...rootResult.mappings].sort((left, right) => compareCodeUnits(left.rootColumn, right.rootColumn) || compareCodeUnits(left.parameterName, right.parameterName)),
    sourceEvidenceIds: evidence.ids(rootEvidenceKeys),
    status: rootResult.partialCodes?.length ? 'ambiguous' : 'resolved',
  };
  const finalStatus = status === 'ready' && blockedReasons.length === 0 ? 'ready' : 'partial';
  return {
    kind: 'fixture-extraction-plan',
    schemaVersion: FIXTURE_EXTRACTION_PLAN_SCHEMA_VERSION,
    status: finalStatus,
    source,
    reproductionKey,
    sourceEvidence: evidence.values(),
    steps: finalized.steps,
    suggestedCaptureOrder: topologicalOrder(finalized.steps, 'dependsOnStepIds'),
    suggestedLoadOrder: topologicalOrder(finalized.steps, 'loadAfterStepIds'),
    blockedReasons,
    limitations: createLimitations(finalized.steps, finalStatus, rootResult.boundaryKind),
  };
}

function assertInput(input: FixtureExtractionInput): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FixtureExtractionInputError('INPUT_SHAPE_INVALID');
  assertAllowedKeys(input as unknown as Record<string, unknown>, ['sql', 'ddl', 'schemaFacts', 'reproductionKey']);
  if (typeof input.sql !== 'string' || input.sql.trim().length === 0) throw new FixtureExtractionInputError('INPUT_SHAPE_INVALID');
  if (input.reproductionKey !== undefined) {
    if (!input.reproductionKey || typeof input.reproductionKey !== 'object' || Array.isArray(input.reproductionKey)) throw new FixtureExtractionInputError('INPUT_SHAPE_INVALID');
    assertAllowedKeys(input.reproductionKey as unknown as Record<string, unknown>, ['parameterNames', 'rootColumns', 'rootRelation']);
    const names = input.reproductionKey.parameterNames;
    if (!Array.isArray(names) || names.some((name) => typeof name !== 'string' || !PARAMETER_NAME.test(name)) || new Set(names).size !== names.length) {
      throw new FixtureExtractionInputError('INPUT_SHAPE_INVALID');
    }
    if (input.reproductionKey.rootRelation !== undefined && (typeof input.reproductionKey.rootRelation !== 'string' || input.reproductionKey.rootRelation.length === 0)) {
      throw new FixtureExtractionInputError('INPUT_SHAPE_INVALID');
    }
    if (input.reproductionKey.rootColumns !== undefined && (!Array.isArray(input.reproductionKey.rootColumns)
      || input.reproductionKey.rootColumns.some((column) => typeof column !== 'string' || column.length === 0))) {
      throw new FixtureExtractionInputError('INPUT_SHAPE_INVALID');
    }
  }
  if (input.ddl !== undefined) {
    if (!Array.isArray(input.ddl)) throw new FixtureExtractionInputError('INPUT_SHAPE_INVALID');
    for (const item of input.ddl) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new FixtureExtractionInputError('INPUT_SHAPE_INVALID');
      assertAllowedKeys(item as unknown as Record<string, unknown>, ['filePath', 'sql']);
      if (typeof item.sql !== 'string' || (item.filePath !== undefined && typeof item.filePath !== 'string')) throw new FixtureExtractionInputError('INPUT_SHAPE_INVALID');
    }
  }
  if (input.schemaFacts !== undefined && !isSchemaFactsShape(input.schemaFacts)) {
    throw new FixtureExtractionInputError('INPUT_SHAPE_INVALID');
  }
}

function isSchemaFactsShape(value: unknown): value is SchemaFacts {
  if (!isRecord(value)) return false;
  assertAllowedKeys(value, ['diagnostics', 'kind', 'tables', 'version']);
  if (value.kind !== 'schema-facts' || value.version !== 1 || !isRecord(value.tables)) return false;
  for (const table of Object.values(value.tables)) {
    if (!isRecord(table)) return false;
    assertAllowedKeys(table, ['columns', 'declaredLogicalForeignKeys', 'foreignKeys', 'name', 'primaryKey', 'schemaName', 'uniqueKeys']);
    if (typeof table.name !== 'string' || !isRecord(table.columns)
      || (table.schemaName !== undefined && typeof table.schemaName !== 'string')
      || !isOptionalStringArray(table.primaryKey)
      || !isOptionalNestedStringArray(table.uniqueKeys)) return false;
    const normalizedColumns = new Set<string>();
    for (const [columnKey, column] of Object.entries(table.columns)) {
      if (!isRecord(column)) return false;
      assertAllowedKeys(column, ['defaultSql', 'name', 'nullable', 'type']);
      if (typeof column.name !== 'string'
        || (column.defaultSql !== undefined && typeof column.defaultSql !== 'string')
        || (column.nullable !== undefined && typeof column.nullable !== 'boolean')
        || (column.type !== undefined && typeof column.type !== 'string')) return false;
      const normalizedColumn = normalizeIdentifier(column.name);
      if (normalizeIdentifier(columnKey) !== normalizedColumn || normalizedColumns.has(normalizedColumn)) return false;
      normalizedColumns.add(normalizedColumn);
    }
    const primaryKey = table.primaryKey as string[] | undefined;
    const uniqueKeys = table.uniqueKeys as string[][] | undefined;
    const keys: string[][] = [...(primaryKey ? [primaryKey] : []), ...(uniqueKeys ?? [])];
    if (keys.some((key) => key.length === 0
      || new Set(key.map(normalizeIdentifier)).size !== key.length
      || key.some((column) => !normalizedColumns.has(normalizeIdentifier(column))))) return false;
    if (!isRelationshipArray(table.foreignKeys, normalizedColumns, false)
      || !isRelationshipArray(table.declaredLogicalForeignKeys, normalizedColumns, true)) return false;
  }
  if (value.diagnostics !== undefined) {
    if (!Array.isArray(value.diagnostics)) return false;
    for (const diagnostic of value.diagnostics) {
      if (!isRecord(diagnostic)) return false;
      assertAllowedKeys(diagnostic, ['code', 'filePath', 'message', 'severity']);
      if (typeof diagnostic.code !== 'string' || typeof diagnostic.message !== 'string'
        || !['error', 'info', 'warning'].includes(String(diagnostic.severity))
        || (diagnostic.filePath !== undefined && typeof diagnostic.filePath !== 'string')) return false;
    }
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isOptionalStringArray(value: unknown): boolean {
  return value === undefined || isStringArray(value);
}

function isOptionalNestedStringArray(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(isStringArray));
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_INPUT_KEYS.has(key)) throw new FixtureExtractionInputError('VALUE_BEARING_INPUT_FORBIDDEN');
    if (!allowed.includes(key)) throw new FixtureExtractionInputError('INPUT_SHAPE_INVALID');
  }
}

function collectOccurrenceGraph(statement: SimpleSelectQuery | BinarySelectQuery): OccurrenceGraph {
  const graph: OccurrenceGraph = {
    edges: [],
    hasRecursiveCte: false,
    hasSetOperation: statement instanceof BinarySelectQuery,
    occurrences: [],
  };
  collectSelect(statement, 'query', new Map(), new Map(), new Set(), graph);
  return graph;
}

function collectSelect(
  query: SimpleSelectQuery | BinarySelectQuery,
  path: string,
  outerAliases: Map<string, Occurrence>,
  inheritedCtes: Map<string, SimpleSelectQuery | BinarySelectQuery>,
  activeCteQueries: ReadonlySet<SimpleSelectQuery | BinarySelectQuery>,
  graph: OccurrenceGraph,
): Occurrence[] {
  if (query instanceof BinarySelectQuery) {
    graph.hasSetOperation = true;
    return [
      ...collectSelect(query.left as SimpleSelectQuery | BinarySelectQuery, `${path}.left`, outerAliases, inheritedCtes, activeCteQueries, graph),
      ...collectSelect(query.right as SimpleSelectQuery | BinarySelectQuery, `${path}.right`, outerAliases, inheritedCtes, activeCteQueries, graph),
    ];
  }
  const ctes = new Map(inheritedCtes);
  for (const table of query.withClause?.tables ?? []) {
    if (table.query instanceof SimpleSelectQuery || table.query instanceof BinarySelectQuery) {
      ctes.set(normalizeIdentifier(table.getSourceAliasName()), table.query);
    }
  }
  const localAliases = new Map<string, Occurrence>();
  const localOccurrences: Occurrence[] = [];
  const allAliases = (): Map<string, Occurrence> => new Map([...outerAliases, ...localAliases]);
  const sources = query.fromClause?.getSources() ?? [];
  for (const [sourceIndex, source] of sources.entries()) {
    const sourcePath = `${path}.from[${String(sourceIndex).padStart(4, '0')}]`;
    const collected = collectSource(source, sourcePath, allAliases(), ctes, activeCteQueries, graph);
    collected.forEach((occurrence) => {
      localOccurrences.push(occurrence);
      localAliases.set(normalizeIdentifier(occurrence.alias), occurrence);
      localAliases.set(normalizeIdentifier(baseRelationName(occurrence.relationName)), occurrence);
    });
    if (sourceIndex > 0) {
      const join = query.fromClause?.joins?.[sourceIndex - 1];
      const related = collected.length === 1 ? collected[0] : undefined;
      if (join && related) collectJoinEdge(join, related, allAliases(), `${sourcePath}.join`, graph);
    }
  }
  if (query.whereClause) {
    collectWhere(query.whereClause.condition, `${path}.where`, localOccurrences, allAliases(), ctes, activeCteQueries, graph);
  }
  return localOccurrences;
}

function collectSource(
  source: SourceExpression,
  path: string,
  outerAliases: Map<string, Occurrence>,
  ctes: Map<string, SimpleSelectQuery | BinarySelectQuery>,
  activeCteQueries: ReadonlySet<SimpleSelectQuery | BinarySelectQuery>,
  graph: OccurrenceGraph,
): Occurrence[] {
  const datasource = unwrapSource(source.datasource);
  if (datasource instanceof TableSource) {
    const relationName = tableSourceName(datasource);
    const cte = ctes.get(normalizeIdentifier(relationName));
    if (cte) {
      if (activeCteQueries.has(cte)) {
        graph.hasRecursiveCte = true;
        return [];
      }
      return collectSelect(cte, `${path}.cte`, outerAliases, ctes, new Set([...activeCteQueries, cte]), graph);
    }
    const occurrence: Occurrence = {
      alias: source.getAliasName() ?? baseRelationName(relationName),
      caseSensitiveIdentityUnproven: tableSourceSegments(datasource).some((segment) => segment !== segment.toLowerCase()),
      occurrenceId: '',
      parameterEqualities: [],
      path,
      populationParameterEqualities: [],
      populationStaticEqualities: [],
      relationName,
      unsafePopulationPredicate: false,
    };
    graph.occurrences.push(occurrence);
    return [occurrence];
  }
  if (datasource instanceof SubQuerySource) {
    return collectSelect(datasource.query as SimpleSelectQuery | BinarySelectQuery, `${path}.subquery`, outerAliases, ctes, activeCteQueries, graph);
  }
  return [];
}

function collectJoinEdge(join: JoinClause, related: Occurrence, aliases: Map<string, Occurrence>, path: string, graph: OccurrenceGraph): void {
  const equalityPairs: EqualityPair[] = [];
  const predicateOccurrences: Occurrence[] = [];
  const localParameterEqualities: ParameterEquality[] = [];
  const joinType = rawValue(join.joinType).toLowerCase();
  const supportsAnchorPopulationConstraint = joinType.includes('join')
    && !joinType.includes('left')
    && !joinType.includes('right')
    && !joinType.includes('full');
  let unsafePredicate = !(join.condition instanceof JoinOnClause);
  const terms = join.condition instanceof JoinOnClause ? flattenAnd(join.condition.condition) : [];
  for (const [index, term] of terms.entries()) {
    const termPath = `${path}.condition[${String(index).padStart(4, '0')}]`;
    if (!(term instanceof BinaryExpression) || rawValue(term.operator) !== '=') {
      if (term instanceof BinaryExpression) {
        const pair = resolveColumnPair(term.left, term.right, aliases);
        if (pair) predicateOccurrences.push(pair.left.occurrence, pair.right.occurrence);
      }
      if (referencesOccurrence(term, related, aliases)) unsafePredicate = true;
      const anchorOccurrences = [...new Set(aliases.values())]
        .filter((occurrence) => occurrence !== related && referencesOccurrence(term, occurrence, aliases));
      if (anchorOccurrences.length > 0) {
        predicateOccurrences.push(...anchorOccurrences);
        markWherePredicateUnsafe(graph, anchorOccurrences);
      }
      continue;
    }
    const pair = resolveColumnPair(term.left, term.right, aliases);
    if (pair) {
      equalityPairs.push(pair);
      continue;
    }
    const parameter = resolveColumnParameter(term.left, term.right, aliases, termPath, 'join');
    if (parameter) {
      if (parameter.occurrence === related) {
        related.parameterEqualities.push(parameter.equality);
        localParameterEqualities.push(parameter.equality);
      } else if (supportsAnchorPopulationConstraint) {
        predicateOccurrences.push(parameter.occurrence);
        addWhereParameterEquality(graph, parameter.occurrence, parameter.equality);
      } else {
        predicateOccurrences.push(parameter.occurrence);
        markWherePredicateUnsafe(graph, [parameter.occurrence]);
      }
      continue;
    }
    const staticEquality = resolveColumnLiteral(term.left, term.right, aliases, termPath);
    if (staticEquality && staticEquality.occurrence !== related) {
      predicateOccurrences.push(staticEquality.occurrence);
      if (supportsAnchorPopulationConstraint) {
        addWhereStaticEquality(graph, staticEquality.occurrence, staticEquality.equality);
      } else {
        markWherePredicateUnsafe(graph, [staticEquality.occurrence]);
      }
      continue;
    }
    if (referencesOccurrence(term, related, aliases)) unsafePredicate = true;
  }
  const anchor = [...equalityPairs.flatMap((pair) => [pair.left.occurrence, pair.right.occurrence]), ...predicateOccurrences]
    .find((occurrence) => occurrence !== related);
  if (!anchor) unsafePredicate = true;
  graph.edges.push({
    anchor: anchor ?? related,
    equalityPairs,
    evidencePath: path,
    joinType,
    kind: 'join',
    localParameterEqualities,
    localStaticEqualities: [],
    notExists: false,
    related,
    unsafePredicate,
  });
}

function collectWhere(
  condition: unknown,
  path: string,
  localOccurrences: Occurrence[],
  aliases: Map<string, Occurrence>,
  ctes: Map<string, SimpleSelectQuery | BinarySelectQuery>,
  activeCteQueries: ReadonlySet<SimpleSelectQuery | BinarySelectQuery>,
  graph: OccurrenceGraph,
): void {
  const localSet = new Set(localOccurrences);
  for (const [index, term] of flattenAnd(condition).entries()) {
    const termPath = `${path}[${String(index).padStart(4, '0')}]`;
    const exists = unwrapExists(term);
    if (exists) {
      const before = new Set(graph.occurrences);
      const relatedOccurrences = collectSelect(exists.query, `${termPath}.exists`, aliases, ctes, activeCteQueries, graph)
        .filter((occurrence) => !before.has(occurrence));
      const related = relatedOccurrences.length === 1 ? relatedOccurrences[0] : undefined;
      if (!related) continue;
      const nestedAliases = new Map(aliases);
      nestedAliases.set(normalizeIdentifier(related.alias), related);
      nestedAliases.set(normalizeIdentifier(baseRelationName(related.relationName)), related);
      const correlations: EqualityPair[] = [];
      const localParameterEqualities: ParameterEquality[] = [];
      const localStaticEqualities: StaticEquality[] = [];
      const outerOccurrences = new Set(aliases.values());
      let unsafePredicate = !(exists.query instanceof SimpleSelectQuery) || !exists.query.whereClause;
      const nestedTerms = exists.query instanceof SimpleSelectQuery
        ? flattenAnd(exists.query.whereClause?.condition)
        : [];
      for (const [nestedIndex, nestedTerm] of nestedTerms.entries()) {
        const nestedPath = `${termPath}.exists.where[${String(nestedIndex).padStart(4, '0')}]`;
        if (nestedTerm instanceof BinaryExpression && rawValue(nestedTerm.operator) === '=') {
          const pair = resolveColumnPair(nestedTerm.left, nestedTerm.right, nestedAliases);
          if (pair) {
            const other = pair.left.occurrence === related
              ? pair.right.occurrence
              : pair.right.occurrence === related ? pair.left.occurrence : undefined;
            if (other && outerOccurrences.has(other)) {
              correlations.push(pair);
              continue;
            }
          }
          const parameter = resolveColumnParameter(nestedTerm.left, nestedTerm.right, nestedAliases, nestedPath, 'where');
          if (parameter?.occurrence === related) {
            localParameterEqualities.push(parameter.equality);
            continue;
          }
          const staticEquality = resolveColumnLiteral(nestedTerm.left, nestedTerm.right, nestedAliases, nestedPath);
          if (staticEquality?.occurrence === related) {
            localStaticEqualities.push(staticEquality.equality);
            continue;
          }
        }
        unsafePredicate = true;
      }
      const anchor = correlations.flatMap((pair) => [pair.left.occurrence, pair.right.occurrence]).find((occurrence) => occurrence !== related);
      graph.edges.push({
        anchor: anchor ?? related,
        equalityPairs: correlations,
        evidencePath: termPath,
        joinType: 'exists',
        kind: 'exists',
        localParameterEqualities,
        localStaticEqualities,
        notExists: exists.notExists,
        related,
        unsafePredicate: unsafePredicate || !anchor || correlations.length === 0,
      });
      continue;
    }
    if (term instanceof BinaryExpression && rawValue(term.operator) === '=') {
      const parameter = resolveColumnParameter(term.left, term.right, aliases, termPath, 'where');
      if (parameter && localSet.has(parameter.occurrence)) {
        parameter.occurrence.parameterEqualities.push(parameter.equality);
        addWhereParameterEquality(graph, parameter.occurrence, parameter.equality);
        continue;
      }
      const staticEquality = resolveColumnLiteral(term.left, term.right, aliases, termPath);
      if (staticEquality && localSet.has(staticEquality.occurrence)) {
        addWhereStaticEquality(graph, staticEquality.occurrence, staticEquality.equality);
        continue;
      }
      const pair = resolveColumnPair(term.left, term.right, aliases);
      if (pair) {
        const localPairOccurrences = [pair.left.occurrence, pair.right.occurrence].filter((occurrence) => localSet.has(occurrence));
        if (localPairOccurrences.length === 1) continue;
      }
    }
    const referencedOccurrences = localOccurrences.filter((occurrence) => referencesOccurrence(term, occurrence, aliases));
    markWherePredicateUnsafe(graph, referencedOccurrences.length > 0 ? referencedOccurrences : localOccurrences);
  }
}

function addWhereParameterEquality(graph: OccurrenceGraph, occurrence: Occurrence, equality: ParameterEquality): void {
  addOccurrenceParameterEquality(occurrence, equality);
  for (const edge of graph.edges.filter((item) => item.related === occurrence)) {
    if (edge.localParameterEqualities.some((item) => (
      normalizeIdentifier(item.column) === normalizeIdentifier(equality.column) && item.parameter === equality.parameter
    ))) continue;
    edge.localParameterEqualities.push(equality);
  }
}

function addWhereStaticEquality(graph: OccurrenceGraph, occurrence: Occurrence, equality: StaticEquality): void {
  addOccurrenceStaticEquality(occurrence, equality);
  for (const edge of graph.edges.filter((item) => item.related === occurrence)) {
    if (edge.localStaticEqualities.some((item) => (
      normalizeIdentifier(item.column) === normalizeIdentifier(equality.column) && item.literalSql === equality.literalSql
    ))) continue;
    edge.localStaticEqualities.push(equality);
  }
}

function markWherePredicateUnsafe(graph: OccurrenceGraph, occurrences: Occurrence[]): void {
  const occurrenceSet = new Set(occurrences);
  occurrenceSet.forEach((occurrence) => { occurrence.unsafePopulationPredicate = true; });
  graph.edges.filter((edge) => occurrenceSet.has(edge.related)).forEach((edge) => { edge.unsafePredicate = true; });
}

function addOccurrenceParameterEquality(occurrence: Occurrence, equality: ParameterEquality): void {
  if (occurrence.populationParameterEqualities.some((item) => (
    normalizeIdentifier(item.column) === normalizeIdentifier(equality.column) && item.parameter === equality.parameter
  ))) return;
  occurrence.populationParameterEqualities.push(equality);
}

function addOccurrenceStaticEquality(occurrence: Occurrence, equality: StaticEquality): void {
  if (occurrence.populationStaticEqualities.some((item) => (
    normalizeIdentifier(item.column) === normalizeIdentifier(equality.column) && item.literalSql === equality.literalSql
  ))) return;
  occurrence.populationStaticEqualities.push(equality);
}

function resolveColumnPair(left: unknown, right: unknown, aliases: Map<string, Occurrence>): EqualityPair | undefined {
  if (!(left instanceof ColumnReference) || !(right instanceof ColumnReference)) return undefined;
  const leftRef = resolveColumn(left, aliases);
  const rightRef = resolveColumn(right, aliases);
  return leftRef && rightRef && leftRef.occurrence !== rightRef.occurrence ? { left: leftRef, right: rightRef } : undefined;
}

function resolveColumnParameter(
  left: unknown,
  right: unknown,
  aliases: Map<string, Occurrence>,
  evidencePath: string,
  kind: ParameterEquality['kind'],
): { equality: ParameterEquality; occurrence: Occurrence } | undefined {
  const column = left instanceof ColumnReference && right instanceof ParameterExpression
    ? left
    : right instanceof ColumnReference && left instanceof ParameterExpression
      ? right
      : undefined;
  const parameter = left instanceof ParameterExpression ? left : right instanceof ParameterExpression ? right : undefined;
  if (!column || !parameter) return undefined;
  const resolved = resolveColumn(column, aliases);
  if (!resolved) return undefined;
  return {
    occurrence: resolved.occurrence,
    equality: { column: resolved.column, evidencePath, kind, parameter: rawValue(parameter.name) },
  };
}

function resolveColumnLiteral(
  left: unknown,
  right: unknown,
  aliases: Map<string, Occurrence>,
  evidencePath: string,
): { equality: StaticEquality; occurrence: Occurrence } | undefined {
  const column = left instanceof ColumnReference && right instanceof LiteralValue
    ? left
    : right instanceof ColumnReference && left instanceof LiteralValue
      ? right
      : undefined;
  const literal = left instanceof LiteralValue ? left : right instanceof LiteralValue ? right : undefined;
  if (!column || !literal) return undefined;
  const resolved = resolveColumn(column, aliases);
  const literalSql = formatStaticLiteral(literal);
  if (!resolved || !literalSql) return undefined;
  return {
    occurrence: resolved.occurrence,
    equality: { column: resolved.column, evidencePath, literalSql },
  };
}

function resolveColumn(reference: ColumnReference, aliases: Map<string, Occurrence>): { column: string; occurrence: Occurrence } | undefined {
  const namespace = reference.getNamespace();
  const column = identifierValue(reference.column);
  if (namespace) {
    const occurrence = aliases.get(normalizeIdentifier(namespace));
    return occurrence ? { column, occurrence } : undefined;
  }
  const occurrences = [...new Set(aliases.values())];
  return occurrences.length === 1 ? { column, occurrence: occurrences[0] } : undefined;
}

function deriveSteps(graph: OccurrenceGraph, rootDraft: BoundedDraft, evidence: EvidenceRegistry): StepDraft[] {
  const drafts: StepDraft[] = [rootDraft];
  const boundedByOccurrence = new Map<Occurrence, BoundedDraft>([[rootDraft.occurrence, rootDraft]]);
  const pending = graph.edges.slice();
  let progress = true;
  while (progress) {
    progress = false;
    for (const edge of pending) {
      if (drafts.some((draft) => draft.occurrence === edge.related)) continue;
      const anchor = boundedByOccurrence.get(edge.anchor);
      if (!anchor) continue;
      const draft = deriveRelatedStep(
        edge,
        anchor,
        evidence,
        hasPopulationRequiredJoinPrerequisite(graph, edge),
      );
      drafts.push(draft);
      if (!isUnknownDraft(draft)) boundedByOccurrence.set(edge.related, draft);
      progress = true;
    }
  }
  for (const occurrence of graph.occurrences) {
    if (drafts.some((draft) => draft.occurrence === occurrence)) continue;
    const anchor = rootDraft;
    const evidenceKeys = createRelatedEvidence(evidence, occurrence, undefined, `${occurrence.path}.unbounded`, 'join');
    drafts.push({
      attemptedHopCount: 1,
      dependsOn: anchor.occurrence,
      derivation: 'join_key_propagation',
      evidenceKeys,
      occurrence,
      parameterNames: rootDraft.parameterNames,
      reasonCodes: ['PARAMETER_PROPAGATION_UNPROVEN', 'CAPTURE_BOUNDARY_UNBOUNDED'],
    });
  }
  return drafts;
}

function isRelationshipArray(value: unknown, normalizedColumns: ReadonlySet<string>, requireReviewed: boolean): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  for (const foreignKey of value) {
    if (!isRecord(foreignKey)) return false;
    assertAllowedKeys(foreignKey, requireReviewed ? ['columns', 'refColumns', 'refTable', 'reviewed'] : ['columns', 'refColumns', 'refTable']);
    if (!isStringArray(foreignKey.columns) || !isStringArray(foreignKey.refColumns) || typeof foreignKey.refTable !== 'string'
      || (requireReviewed && foreignKey.reviewed !== true)) return false;
    if (foreignKey.columns.length === 0 || foreignKey.columns.length !== foreignKey.refColumns.length
      || new Set(foreignKey.columns.map(normalizeIdentifier)).size !== foreignKey.columns.length
      || new Set(foreignKey.refColumns.map(normalizeIdentifier)).size !== foreignKey.refColumns.length
      || foreignKey.columns.some((column) => !normalizedColumns.has(normalizeIdentifier(column)))) return false;
  }
  return true;
}

function hasPopulationRequiredJoinPrerequisite(graph: OccurrenceGraph, edge: OccurrenceEdge): boolean {
  if (edge.kind !== 'exists' || !edge.notExists) return false;
  const reachableOccurrences = new Set<Occurrence>([edge.anchor]);
  const reachableJoinEdges = new Set<OccurrenceEdge>();
  let progress = true;
  while (progress) {
    progress = false;
    for (const candidate of graph.edges) {
      if (candidate.kind !== 'join' || reachableJoinEdges.has(candidate) || !reachableOccurrences.has(candidate.anchor)) continue;
      reachableJoinEdges.add(candidate);
      if (!reachableOccurrences.has(candidate.related)) {
        reachableOccurrences.add(candidate.related);
        progress = true;
      }
    }
  }
  return [...reachableJoinEdges].some((candidate) => (
    ['join', 'inner join'].includes(candidate.joinType)
    || (candidate.joinType === 'left join' && isNullRejectedPopulationOccurrence(candidate.related))
  ));
}

function isNullRejectedPopulationOccurrence(occurrence: Occurrence): boolean {
  return occurrence.populationParameterEqualities.length > 0
    || occurrence.populationStaticEqualities.length > 0
    || occurrence.unsafePopulationPredicate;
}

function deriveRelatedStep(
  edge: OccurrenceEdge,
  anchor: BoundedDraft,
  evidence: EvidenceRegistry,
  hasPopulationPrerequisite = false,
): StepDraft {
  const attemptedHopCount = anchor.hop + 1;
  const derivation: FixtureExtractionPredicateDerivation = edge.kind === 'exists'
    ? 'exists_dependency'
    : attemptedHopCount === 2 ? 'foreign_key_dependency' : 'join_key_propagation';
  const evidenceKind = edge.kind === 'exists' ? 'exists' : 'join';
  const relationEvidence = createRelatedEvidence(evidence, edge.related, undefined, edge.evidencePath, evidenceKind);
  if (anchor.relationPath.includes(normalizeIdentifier(edge.related.relationName))) {
    return unknownDraft(edge, anchor, derivation, relationEvidence, attemptedHopCount, ['RELATIONSHIP_CYCLE_UNSUPPORTED']);
  }
  if (hasPopulationPrerequisite) {
    return unknownDraft(edge, anchor, derivation, relationEvidence, attemptedHopCount, ['PARAMETER_PROPAGATION_UNPROVEN', 'CAPTURE_BOUNDARY_UNBOUNDED']);
  }
  if (edge.unsafePredicate || anchor.occurrence.unsafePopulationPredicate) {
    const codes: FixtureExtractionBlockedCode[] = edge.kind === 'join' && edge.equalityPairs.length === 0
      ? ['NON_EQUALITY_JOIN_UNSUPPORTED']
      : ['PARAMETER_PROPAGATION_UNPROVEN', 'CAPTURE_BOUNDARY_UNBOUNDED'];
    return unknownDraft(edge, anchor, derivation, relationEvidence, attemptedHopCount, codes);
  }
  if (edge.kind === 'join' && !['join', 'inner join', 'left join'].includes(edge.joinType)) {
    return unknownDraft(edge, anchor, derivation, relationEvidence, attemptedHopCount, ['JOIN_BOUNDARY_UNPROVEN']);
  }
  if (edge.related.tableResolution === 'ambiguous') {
    return unknownDraft(edge, anchor, derivation, relationEvidence, attemptedHopCount, ['RELATION_UNRESOLVED']);
  }
  if (!edge.related.table || !edge.anchor.table) {
    return unknownDraft(edge, anchor, derivation, relationEvidence, attemptedHopCount, ['SCHEMA_FACTS_REQUIRED']);
  }
  const fkResult = resolveForeignKey(edge);
  if (fkResult.status === 'missing') {
    return unknownDraft(edge, anchor, derivation, relationEvidence, attemptedHopCount, ['SCHEMA_FACTS_REQUIRED']);
  }
  if (fkResult.status === 'ambiguous') {
    return unknownDraft(edge, anchor, derivation, relationEvidence, attemptedHopCount, ['FOREIGN_KEY_AMBIGUOUS']);
  }
  const fkEvidence = evidence.add(
    fkResult.relationship.kind === 'physical_foreign_key' ? 'schema_foreign_key' : 'schema_declared_logical_foreign_key',
    `${edge.related.relationName}->${edge.anchor.relationName}:${fkResult.relationship.facts.columns.join(',')}`,
    `${edge.evidencePath}.schema-fk`,
  );
  const evidenceKeys = [...relationEvidence, fkEvidence];
  const relatedColumn = fkResult.relatedColumn;
  const anchorColumn = fkResult.anchorColumn;
  const anchorConstraints = anchor.constraintsByColumn.get(normalizeIdentifier(anchorColumn)) ?? [];
  const anchorPopulationConstraintCount = anchor.occurrence.populationParameterEqualities.length
    + anchor.occurrence.populationStaticEqualities.length;
  const directParameter = anchorPopulationConstraintCount <= 1
    && anchorConstraints.length === 1
    && anchorConstraints[0].kind === 'parameter'
    ? anchorConstraints[0].value
    : undefined;
  const sameColumnParameters = edge.localParameterEqualities
    .filter((item) => normalizeIdentifier(item.column) === normalizeIdentifier(relatedColumn));
  const sameColumnStaticEqualities = edge.localStaticEqualities
    .filter((item) => normalizeIdentifier(item.column) === normalizeIdentifier(relatedColumn));
  if (sameColumnStaticEqualities.length > 0
    || sameColumnParameters.some((item) => !directParameter || item.parameter !== directParameter)) {
    return unknownDraft(edge, anchor, derivation, evidenceKeys, attemptedHopCount, ['PARAMETER_PROPAGATION_UNPROVEN', 'CAPTURE_BOUNDARY_UNBOUNDED']);
  }
  const localParameters = edge.localParameterEqualities
    .filter((item) => normalizeIdentifier(item.column) !== normalizeIdentifier(relatedColumn))
    .sort((left, right) => compareCodeUnits(left.column, right.column) || compareCodeUnits(left.parameter, right.parameter));
  const localStaticEqualities = edge.localStaticEqualities
    .filter((item) => normalizeIdentifier(item.column) !== normalizeIdentifier(relatedColumn))
    .sort((left, right) => compareCodeUnits(left.column, right.column) || compareCodeUnits(left.literalSql, right.literalSql));
  if (localParameters.some((item) => !tableHasColumn(edge.related.table!, item.column))) {
    return unknownDraft(edge, anchor, derivation, evidenceKeys, attemptedHopCount, ['SCHEMA_FACTS_REQUIRED']);
  }
  if (localStaticEqualities.some((item) => !tableHasColumn(edge.related.table!, item.column))) {
    return unknownDraft(edge, anchor, derivation, evidenceKeys, attemptedHopCount, ['SCHEMA_FACTS_REQUIRED']);
  }
  if (localParameters.some((item) => !PARAMETER_NAME.test(item.parameter))) {
    return unknownDraft(edge, anchor, derivation, evidenceKeys, attemptedHopCount, ['PARAMETER_PROPAGATION_UNPROVEN', 'CAPTURE_BOUNDARY_UNBOUNDED']);
  }
  let predicateSql: string;
  let boundaryReason: BoundedDraft['boundaryReason'];
  const constraintsByColumn = new Map<string, PropagatedConstraint[]>();
  if (directParameter) {
    const predicates = [{ column: relatedColumn, parameter: directParameter }, ...localParameters.map((item) => ({ column: item.column, parameter: item.parameter }))]
      .sort((left, right) => compareCodeUnits(left.column, right.column) || compareCodeUnits(left.parameter, right.parameter));
    predicateSql = [
      ...predicates.map((item) => `${quoteIdentifier(item.column)} = :${item.parameter}`),
      ...localStaticEqualities.map((item) => `${quoteIdentifier(item.column)} = ${item.literalSql}`),
    ].join(' and ');
    predicates.forEach((item) => addPropagatedConstraint(constraintsByColumn, item.column, { kind: 'parameter', value: item.parameter }));
    localStaticEqualities.forEach((item) => addPropagatedConstraint(constraintsByColumn, item.column, { kind: 'static', value: item.literalSql }));
    boundaryReason = edge.kind === 'exists' ? 'correlated_exists_key_equality' : 'direct_key_equality_propagation';
  } else {
    predicateSql = [
      `${quoteIdentifier(relatedColumn)} in (\n  select ${quoteIdentifier(anchorColumn)}\n  from ${quoteRelation(anchor.occurrence.relationName)}\n  where ${anchor.predicateSql}\n)`,
      ...localParameters.map((item) => `${quoteIdentifier(item.column)} = :${item.parameter}`),
      ...localStaticEqualities.map((item) => `${quoteIdentifier(item.column)} = ${item.literalSql}`),
    ].join(' and ');
    localParameters.forEach((item) => addPropagatedConstraint(constraintsByColumn, item.column, { kind: 'parameter', value: item.parameter }));
    localStaticEqualities.forEach((item) => addPropagatedConstraint(constraintsByColumn, item.column, { kind: 'static', value: item.literalSql }));
    boundaryReason = 'nested_foreign_key_subquery';
  }
  const parameterNames = collectParameterNamesFromSql(`select * from ${quoteRelation(edge.related.relationName)} where ${predicateSql};`);
  if (parameterNames.some((parameter) => !PARAMETER_NAME.test(parameter))) {
    return unknownDraft(edge, anchor, derivation, evidenceKeys, attemptedHopCount, ['PARAMETER_PROPAGATION_UNPROVEN', 'CAPTURE_BOUNDARY_UNBOUNDED']);
  }
  const boundaryColumns = [
    relatedColumn,
    ...localParameters.map((item) => item.column),
    ...localStaticEqualities.map((item) => item.column),
  ].sort(compareCodeUnits);
  const resultExpectation = edge.kind === 'exists' && edge.notExists ? emptyResultRequired() : rowsMayBePresent();
  const sql = buildDirectSelect(edge.related, predicateSql);
  return {
    boundaryReason,
    boundaryRelationColumns: boundaryColumns,
    dependsOn: anchor.occurrence,
    derivation,
    evidenceKeys,
    hop: attemptedHopCount,
    loadAfter: fkResult.relatedIsChild ? anchor.occurrence : undefined,
    occurrence: edge.related,
    constraintsByColumn,
    parameterNames,
    predicateSql,
    relationPath: [...anchor.relationPath, normalizeIdentifier(edge.related.relationName)],
    resultExpectation,
    sql,
  };
}

function addPropagatedConstraint(
  constraintsByColumn: Map<string, PropagatedConstraint[]>,
  column: string,
  constraint: PropagatedConstraint,
): void {
  const key = normalizeIdentifier(column);
  const current = constraintsByColumn.get(key) ?? [];
  if (current.some((item) => item.kind === constraint.kind && item.value === constraint.value)) return;
  constraintsByColumn.set(key, [...current, constraint].sort((left, right) => compareCodeUnits(left.kind, right.kind) || compareCodeUnits(left.value, right.value)));
}

function unknownDraft(
  edge: OccurrenceEdge,
  anchor: BoundedDraft,
  derivation: FixtureExtractionPredicateDerivation,
  evidenceKeys: string[],
  attemptedHopCount: number,
  reasonCodes: FixtureExtractionBlockedCode[],
): UnknownDraft {
  return {
    attemptedHopCount,
    dependsOn: anchor.occurrence,
    derivation,
    evidenceKeys,
    occurrence: edge.related,
    parameterNames: anchor.parameterNames,
    reasonCodes: sortBlockedCodes(reasonCodes),
  };
}

function resolveForeignKey(edge: OccurrenceEdge):
  | { status: 'ambiguous' }
  | { status: 'missing' }
  | { anchorColumn: string; relatedColumn: string; relatedIsChild: boolean; relationship: RelationshipCandidate; status: 'resolved' } {
  if (edge.equalityPairs.length !== 1 || !edge.related.table || !edge.anchor.table) return { status: edge.equalityPairs.length === 0 ? 'missing' : 'ambiguous' };
  const pair = edge.equalityPairs[0];
  const relatedColumn = pair.left.occurrence === edge.related ? pair.left.column : pair.right.column;
  const anchorColumn = pair.left.occurrence === edge.anchor ? pair.left.column : pair.right.column;
  if (!tableHasColumn(edge.related.table, relatedColumn) || !tableHasColumn(edge.anchor.table, anchorColumn)) return { status: 'missing' };
  const candidates = relationshipCandidates(edge.related.table).filter((relationship) => relationship.facts.columns.length === 1
    && relationship.facts.refColumns.length === 1
    && normalizeIdentifier(relationship.facts.columns[0]) === normalizeIdentifier(relatedColumn)
    && normalizeIdentifier(relationship.facts.refColumns[0]) === normalizeIdentifier(anchorColumn)
    && foreignKeyTargets(relationship.facts.refTable, edge.related.table!, edge.anchor.table!)
    && foreignKeyHasExistingColumns(relationship.facts, edge.related.table!, edge.anchor.table!)
    && isTableUniqueKey(edge.anchor.table!, [anchorColumn]));
  if (candidates.length === 1) return { status: 'resolved', anchorColumn, relationship: candidates[0], relatedColumn, relatedIsChild: true };
  if (candidates.length > 1) return { status: 'ambiguous' };
  const reverse = relationshipCandidates(edge.anchor.table).filter((relationship) => relationship.facts.columns.length === 1
    && relationship.facts.refColumns.length === 1
    && normalizeIdentifier(relationship.facts.columns[0]) === normalizeIdentifier(anchorColumn)
    && normalizeIdentifier(relationship.facts.refColumns[0]) === normalizeIdentifier(relatedColumn)
    && foreignKeyTargets(relationship.facts.refTable, edge.anchor.table!, edge.related.table!)
    && foreignKeyHasExistingColumns(relationship.facts, edge.anchor.table!, edge.related.table!)
    && isTableUniqueKey(edge.related.table!, [relatedColumn]));
  if (reverse.length === 1) return { status: 'resolved', anchorColumn, relationship: reverse[0], relatedColumn, relatedIsChild: false };
  return reverse.length > 1 ? { status: 'ambiguous' } : { status: 'missing' };
}

function relationshipCandidates(table: SchemaTableFacts): RelationshipCandidate[] {
  return [
    ...(table.foreignKeys ?? []).map((facts) => ({ facts, kind: 'physical_foreign_key' as const })),
    ...(table.declaredLogicalForeignKeys ?? [])
      .filter((facts) => facts.reviewed === true)
      .map((facts) => ({ facts, kind: 'declared_logical_foreign_key' as const })),
  ];
}

function resolveRoot(
  input: FixtureExtractionInput,
  occurrences: Occurrence[],
  schemaIndex: StrictSchemaIndex,
): { codes: FixtureExtractionBlockedCode[]; ok: false; status: 'ambiguous' | 'blocked' } | {
  boundaryKind: 'key_equality' | 'parameter_predicate';
  keyKind?: 'primary' | 'unique';
  mappings: FixtureExtractionColumnParameterMapping[];
  ok: true;
  partialCodes?: FixtureExtractionBlockedCode[];
  root: Occurrence;
  rootEquality: ParameterEquality;
} {
  if (!input.reproductionKey) return resolveInferredRoot(occurrences);
  const { parameterNames, rootColumns, rootRelation } = input.reproductionKey;
  if (parameterNames.length === 0) return { ok: false, codes: ['REPRODUCTION_KEY_REQUIRED'], status: 'blocked' };
  let candidates = rootRelation
    ? occurrences.filter((occurrence) => relationMatches(rootRelation, occurrence.relationName))
    : occurrences.filter((occurrence) => parameterNames.every((parameter) => occurrence.parameterEqualities.some((item) => item.parameter === parameter && item.kind === 'where')));
  if (rootRelation && !rootRelation.includes('.') && (schemaIndex.byBase.get(normalizeIdentifier(rootRelation))?.length ?? 0) > 1) candidates = [];
  if (candidates.length > 1) {
    candidates = candidates.filter((occurrence) => parameterNames.every((parameter) => occurrence.parameterEqualities.some((item) => item.parameter === parameter && item.kind === 'where')));
  }
  if (candidates.length !== 1 || !candidates[0].table) return { ok: false, codes: ['ROOT_RELATION_UNRESOLVED'], status: 'ambiguous' };
  const root = candidates[0];
  const rootTable = root.table!;
  const columns = rootColumns ? [...rootColumns] : rootTable.primaryKey?.length === 1 ? [...rootTable.primaryKey] : [];
  if (columns.length !== 1 || parameterNames.length !== columns.length || new Set(columns.map(normalizeIdentifier)).size !== columns.length) {
    return { ok: false, codes: ['REPRODUCTION_KEY_AMBIGUOUS'], status: 'ambiguous' };
  }
  if (columns.some((column) => !tableHasColumn(rootTable, column))) {
    return { ok: false, codes: ['SCHEMA_FACTS_REQUIRED'], status: 'blocked' };
  }
  const mappedColumns = new Set(root.parameterEqualities
    .filter((item) => item.kind === 'where' && item.parameter === parameterNames[0])
    .map((item) => normalizeIdentifier(item.column)));
  if (mappedColumns.size > 1) {
    return { ok: false, codes: ['REPRODUCTION_KEY_AMBIGUOUS'], status: 'ambiguous' };
  }
  const keyKind = isSameKey(rootTable.primaryKey, columns) ? 'primary' : (rootTable.uniqueKeys ?? []).some((key) => isSameKey(key, columns)) ? 'unique' : undefined;
  const rootEquality = root.parameterEqualities.find((item) => item.kind === 'where'
    && normalizeIdentifier(item.column) === normalizeIdentifier(columns[0])
    && item.parameter === parameterNames[0]);
  if (!keyKind || !rootEquality) {
    return { ok: false, codes: ['REPRODUCTION_KEY_AMBIGUOUS', 'CAPTURE_BOUNDARY_UNBOUNDED'], status: 'ambiguous' };
  }
  return {
    boundaryKind: 'key_equality',
    ok: true,
    keyKind,
    root,
    rootEquality,
    mappings: [{ parameterName: parameterNames[0], rootColumn: columns[0] }],
  };
}

function finalizeSteps(drafts: StepDraft[], evidence: EvidenceRegistry): { stepIdByOccurrence: Map<Occurrence, string>; steps: FixtureExtractionStep[] } {
  const sorted = [...drafts].sort((left, right) => draftHop(left) - draftHop(right)
    || compareCodeUnits(left.occurrence.relationName, right.occurrence.relationName)
    || compareCodeUnits(left.occurrence.occurrenceId, right.occurrence.occurrenceId)
    || compareCodeUnits(left.derivation, right.derivation));
  const stepIdByOccurrence = new Map(sorted.map((draft, index) => [draft.occurrence, `fixture-step:${String(index + 1).padStart(3, '0')}`]));
  const steps = sorted.map((draft): FixtureExtractionStep => {
    const common = {
      id: stepIdByOccurrence.get(draft.occurrence)!,
      relationName: draft.occurrence.relationName,
      relationOccurrenceId: draft.occurrence.occurrenceId,
      artifactKind: 'fixture_extraction_query' as const,
      dependsOnStepIds: draft.dependsOn ? [stepIdByOccurrence.get(draft.dependsOn)!].filter(Boolean).sort(compareCodeUnits) : [],
      loadAfterStepIds: !isUnknownDraft(draft) && draft.loadAfter ? [stepIdByOccurrence.get(draft.loadAfter)!].filter(Boolean).sort(compareCodeUnits) : [],
      predicateDerivation: draft.derivation,
      sourceEvidenceIds: evidence.ids(draft.evidenceKeys),
      captureColumns: captureColumns(draft.occurrence),
      resultExpectation: isUnknownDraft(draft) ? rowsMayBePresent() : draft.resultExpectation,
    };
    if (isUnknownDraft(draft)) {
      return {
        ...common,
        sql: null,
        parameterNames: [...draft.parameterNames].sort(compareCodeUnits),
        boundary: {
          status: 'unknown',
          reason: 'unproven',
          attemptedHopCount: draft.attemptedHopCount,
          reasonCodes: sortBlockedCodes(draft.reasonCodes),
          sourceEvidenceIds: evidence.ids(draft.evidenceKeys),
        },
        blockedReasonCodes: sortBlockedCodes(draft.reasonCodes),
      } satisfies FixtureExtractionUnknownStep;
    }
    const reparse = inspectStaticSelectSafety(draft.sql);
    if (!reparse.ok) throw new Error('Generated fixture extraction SQL failed static SELECT reparse.');
    return {
      ...common,
      sql: draft.sql,
      parameterNames: [...draft.parameterNames].sort(compareCodeUnits),
      boundary: {
        status: 'bounded',
        reason: draft.boundaryReason,
        hopCount: draft.hop,
        relationColumns: [...new Set(draft.boundaryRelationColumns)].sort(compareCodeUnits),
        parameterNames: [...draft.parameterNames].sort(compareCodeUnits),
        sourceEvidenceIds: evidence.ids(draft.evidenceKeys),
      },
      blockedReasonCodes: [],
    } satisfies FixtureExtractionBoundedStep;
  });
  return { stepIdByOccurrence, steps };
}

/** Infer one physical root relation from its parameterized WHERE equalities. */
function resolveInferredRoot(
  occurrences: Occurrence[],
): { codes: FixtureExtractionBlockedCode[]; ok: false; status: 'ambiguous' | 'blocked' } | {
  boundaryKind: 'key_equality' | 'parameter_predicate';
  keyKind?: 'primary' | 'unique';
  mappings: FixtureExtractionColumnParameterMapping[];
  ok: true;
  partialCodes?: FixtureExtractionBlockedCode[];
  root: Occurrence;
  rootEquality: ParameterEquality;
} {
  const candidates = occurrences.filter((occurrence) => occurrence.parameterEqualities.some((equality) => equality.kind === 'where'));
  if (candidates.length === 0) return { ok: false, codes: ['REPRODUCTION_KEY_REQUIRED'], status: 'blocked' };
  const root = candidates[0];
  const equalities = root.parameterEqualities.filter((equality) => equality.kind === 'where');
  const rootEquality = equalities[0];
  const mappings = [...new Map(equalities.map((equality) => [
    `${normalizeIdentifier(equality.column)}\u0000${equality.parameter}`,
    { parameterName: equality.parameter, rootColumn: equality.column },
  ])).values()];
  const keyKind: 'primary' | 'unique' | undefined = root.table && mappings.length === 1
    ? (isSameKey(root.table.primaryKey, [mappings[0].rootColumn])
      ? 'primary'
      : (root.table.uniqueKeys ?? []).some((key) => isSameKey(key, [mappings[0].rootColumn])) ? 'unique' : undefined)
    : undefined;
  return {
    boundaryKind: keyKind ? 'key_equality' : 'parameter_predicate',
    ok: true,
    ...(keyKind ? { keyKind } : {}),
    ...(candidates.length > 1 ? { partialCodes: ['REPRODUCTION_KEY_AMBIGUOUS'] } : {}),
    root,
    rootEquality,
    mappings,
  };
}

function finalizeBlockedReasons(drafts: BlockedReasonDraft[], stepIds: Map<Occurrence, string>, evidence: EvidenceRegistry): FixtureExtractionBlockedReason[] {
  const unique = new Map<string, FixtureExtractionBlockedReason>();
  for (const draft of drafts) {
    const affectedStepIds = draft.affectedOccurrence ? [stepIds.get(draft.affectedOccurrence)!].filter(Boolean) : [];
    const sourceEvidenceIds = evidence.ids(draft.evidenceKeys);
    const catalog = BLOCKED_CATALOG[draft.code];
    const reason: FixtureExtractionBlockedReason = {
      code: draft.code,
      message: catalog.message,
      requiredFacts: [...catalog.requiredFacts].sort(compareCodeUnits),
      sourceEvidenceIds,
      affectedStepIds,
    };
    unique.set(`${draft.code}\u0000${affectedStepIds.join(',')}\u0000${sourceEvidenceIds.join(',')}`, reason);
  }
  return [...unique.values()].sort((left, right) => BLOCKED_CATALOG[left.code].rank - BLOCKED_CATALOG[right.code].rank
    || compareCodeUnits(left.affectedStepIds.join('\u0000'), right.affectedStepIds.join('\u0000'))
    || compareCodeUnits(left.sourceEvidenceIds.join('\u0000'), right.sourceEvidenceIds.join('\u0000')));
}

function globalBlockedPlan(
  input: FixtureExtractionInput,
  source: FixtureExtractionPlan['source'],
  blockers: readonly StaticSelectSafetyBlocker[],
): FixtureExtractionPlan {
  const evidence = new EvidenceRegistry();
  const drafts: BlockedReasonDraft[] = blockers.map((item) => ({
    code: item.code,
    evidenceKeys: [evidence.add('parser_ast', item.sourceId, item.sourcePath)],
  }));
  const evidenceIds = evidence.ids(drafts.flatMap((draft) => draft.evidenceKeys));
  return {
    kind: 'fixture-extraction-plan',
    schemaVersion: FIXTURE_EXTRACTION_PLAN_SCHEMA_VERSION,
    status: 'blocked',
    source,
    reproductionKey: blockedReproductionKey(input, 'blocked', evidenceIds),
    sourceEvidence: evidence.values(),
    steps: [],
    suggestedCaptureOrder: [],
    suggestedLoadOrder: [],
    blockedReasons: finalizeBlockedReasons(drafts, new Map(), evidence),
    limitations: createLimitations([], 'blocked'),
  };
}

function blockedBeforeRoot(
  input: FixtureExtractionInput,
  source: FixtureExtractionPlan['source'],
  code: FixtureExtractionBlockedCode,
  reproductionStatus: 'ambiguous' | 'blocked',
  evidenceInputs: Array<Omit<EvidenceDraft, 'key'>>,
  additionalCodes: FixtureExtractionBlockedCode[] = [],
): FixtureExtractionPlan {
  const evidence = new EvidenceRegistry();
  const evidenceKeys = evidenceInputs.map((item) => evidence.add(item.kind, item.sourceId, item.sourcePath));
  const codes = sortBlockedCodes([code, ...additionalCodes]);
  return {
    kind: 'fixture-extraction-plan',
    schemaVersion: FIXTURE_EXTRACTION_PLAN_SCHEMA_VERSION,
    status: 'blocked',
    source,
    reproductionKey: blockedReproductionKey(input, reproductionStatus, evidence.ids(evidenceKeys)),
    sourceEvidence: evidence.values(),
    steps: [],
    suggestedCaptureOrder: [],
    suggestedLoadOrder: [],
    blockedReasons: finalizeBlockedReasons(codes.map((item) => ({ code: item, evidenceKeys })), new Map(), evidence),
    limitations: createLimitations([], 'blocked'),
  };
}

function blockedReproductionKey(
  input: FixtureExtractionInput,
  status: 'ambiguous' | 'blocked',
  sourceEvidenceIds: string[],
): FixtureExtractionReproductionKey {
  return {
    parameterNames: [...(input.reproductionKey?.parameterNames ?? [])].sort(compareCodeUnits),
    ...(input.reproductionKey?.rootRelation ? { rootRelation: input.reproductionKey.rootRelation } : {}),
    rootColumns: [...(input.reproductionKey?.rootColumns ?? [])].sort(compareCodeUnits),
    columnParameterMappings: [],
    sourceEvidenceIds,
    status,
  };
}

function createRootEvidence(evidence: EvidenceRegistry, root: Occurrence, keyKind: 'primary' | 'unique' | undefined, equalityPath: string): string[] {
  return [
    evidence.add('parser_ast', `${root.path}:root-equality`, equalityPath),
    evidence.add('where_condition', `${root.path}:root-equality`, equalityPath),
    ...(root.table ? [evidence.add('schema_table', root.relationName, `${root.path}.schema-table`)] : []),
    ...(keyKind ? [evidence.add(keyKind === 'primary' ? 'schema_primary_key' : 'schema_unique_key', `${root.relationName}:root-key`, `${root.path}.schema-key`)] : []),
  ];
}

function createRelatedEvidence(
  evidence: EvidenceRegistry,
  occurrence: Occurrence,
  foreignKey: SchemaForeignKeyFacts | undefined,
  path: string,
  kind: 'exists' | 'join',
): string[] {
  return [
    evidence.add('parser_ast', `${path}:equality`, `${path}.ast`),
    evidence.add(kind === 'exists' ? 'exists_condition' : 'join_condition', `${path}:condition`, `${path}.condition`),
    evidence.add('schema_table', occurrence.relationName, `${occurrence.path}.schema-table`),
    ...(foreignKey ? [evidence.add('schema_foreign_key', `${occurrence.relationName}:${foreignKey.columns.join(',')}`, `${path}.schema-fk`)] : []),
  ];
}

class EvidenceRegistry {
  private readonly drafts = new Map<string, EvidenceDraft>();

  add(kind: FixtureExtractionSourceEvidenceKind, sourceId: string, sourcePath?: string): string {
    const key = `${kind}\u0000${sourcePath ?? ''}\u0000${sourceId}`;
    this.drafts.set(key, { key, kind, sourceId, ...(sourcePath ? { sourcePath } : {}) });
    return key;
  }

  ids(keys: readonly string[]): string[] {
    const idByKey = new Map(this.sorted().map((draft, index) => [draft.key, `fixture-evidence:${String(index + 1).padStart(4, '0')}`]));
    return [...new Set(keys.map((key) => idByKey.get(key)).filter((id): id is string => Boolean(id)))].sort(compareCodeUnits);
  }

  values(): FixtureExtractionSourceEvidence[] {
    return this.sorted().map((draft, index) => ({
      id: `fixture-evidence:${String(index + 1).padStart(4, '0')}`,
      kind: draft.kind,
      sourceId: draft.sourceId,
      ...(draft.sourcePath ? { sourcePath: draft.sourcePath } : {}),
    }));
  }

  private sorted(): EvidenceDraft[] {
    return [...this.drafts.values()].sort((left, right) => EVIDENCE_KIND_RANK[left.kind] - EVIDENCE_KIND_RANK[right.kind]
      || compareCodeUnits(left.sourcePath ?? '', right.sourcePath ?? '')
      || compareCodeUnits(left.sourceId, right.sourceId));
  }
}

function createLimitations(
  steps: readonly FixtureExtractionStep[],
  status: FixtureExtractionPlan['status'],
  boundaryKind?: FixtureExtractionReproductionKey['boundaryKind'],
): FixtureExtractionLimitation[] {
  const codes: FixtureExtractionLimitationCode[] = [
    'STATIC_ONLY_NO_EXECUTION',
    'SENSITIVE_COLUMN_POLICY_NOT_EVALUATED',
    'GENERATED_IDENTITY_LOADING_OUTSIDE_POC',
    'LARGE_OBJECT_MIGRATION_OUTSIDE_POC',
  ];
  if (boundaryKind === 'parameter_predicate') codes.push('ROOT_PREDICATE_MAY_CAPTURE_MULTIPLE_ROWS');
  if (status === 'partial') codes.push('PARTIAL_PLAN_INCOMPLETE');
  return codes.sort((left, right) => LIMITATION_CATALOG[left].rank - LIMITATION_CATALOG[right].rank).map((code) => ({
    code,
    message: LIMITATION_CATALOG[code].message,
    appliesToStepIds: code === 'PARTIAL_PLAN_INCOMPLETE' ? steps.map((step) => step.id).sort(compareCodeUnits) : [],
  }));
}

function topologicalOrder(steps: readonly FixtureExtractionStep[], key: 'dependsOnStepIds' | 'loadAfterStepIds'): string[] {
  const bounded = steps.filter((step): step is FixtureExtractionBoundedStep => step.sql !== null);
  const remaining = new Map(bounded.map((step) => [step.id, new Set(step[key].filter((dependency) => bounded.some((item) => item.id === dependency)))]));
  const order: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining].filter(([, dependencies]) => [...dependencies].every((dependency) => order.includes(dependency))).map(([id]) => id).sort(compareCodeUnits);
    if (ready.length === 0) return [];
    for (const id of ready) { order.push(id); remaining.delete(id); }
  }
  return order;
}

function createStrictSchemaIndex(schemaFacts: SchemaFacts | undefined): StrictSchemaIndex {
  const index: StrictSchemaIndex = { byBase: new Map(), byQualified: new Map() };
  for (const table of Object.values(schemaFacts?.tables ?? {}).sort((left, right) => compareCodeUnits(qualifiedTableName(left), qualifiedTableName(right)))) {
    const qualified = normalizeIdentifier(qualifiedTableName(table));
    const base = normalizeIdentifier(table.name);
    index.byQualified.set(qualified, table);
    index.byBase.set(base, [...(index.byBase.get(base) ?? []), table]);
  }
  return index;
}

function findBlockingSchemaDiagnostics(schemaFacts: SchemaFacts | undefined): SchemaFactsDiagnostic[] {
  // Fixture extraction requires complete, attributable schema evidence. Even an
  // informational diagnostic means some DDL evidence was not fully incorporated,
  // so the planner cannot prove a bounded capture boundary and must fail closed.
  const diagnostics = schemaFacts?.diagnostics ?? [];
  return [...diagnostics].sort((left, right) => compareCodeUnits(left.code, right.code)
    || compareCodeUnits(left.filePath ?? '', right.filePath ?? '')
    || compareCodeUnits(left.severity, right.severity)
    || compareCodeUnits(left.message, right.message));
}

function hasTableCrossFieldIntegrity(table: SchemaTableFacts, index: StrictSchemaIndex): boolean {
  const keys = [...(table.primaryKey ? [table.primaryKey] : []), ...(table.uniqueKeys ?? [])];
  if (keys.some((key) => key.length === 0
    || new Set(key.map(normalizeIdentifier)).size !== key.length
    || key.some((column) => !tableHasColumn(table, column)))) return false;
  for (const relationship of relationshipCandidates(table)) {
    const foreignKey = relationship.facts;
    if (foreignKey.columns.length === 0 || foreignKey.columns.length !== foreignKey.refColumns.length
      || new Set(foreignKey.columns.map(normalizeIdentifier)).size !== foreignKey.columns.length
      || new Set(foreignKey.refColumns.map(normalizeIdentifier)).size !== foreignKey.refColumns.length
      || foreignKey.columns.some((column) => !tableHasColumn(table, column))) return false;
    const targetName = foreignKey.refTable.includes('.')
      ? foreignKey.refTable
      : table.schemaName ? `${table.schemaName}.${foreignKey.refTable}` : foreignKey.refTable;
    const target = resolveStrictTable(index, targetName);
    if (target.status === 'ambiguous') return false;
    if (target.table && (!foreignKey.refColumns.every((column) => tableHasColumn(target.table!, column))
      || !isTableUniqueKey(target.table, foreignKey.refColumns))) return false;
  }
  return true;
}

function resolveStrictTable(index: StrictSchemaIndex, relationName: string): {
  status: 'ambiguous' | 'missing' | 'resolved';
  table?: SchemaTableFacts;
} {
  const normalized = normalizeIdentifier(relationName);
  if (relationName.includes('.')) {
    const table = index.byQualified.get(normalized);
    return table ? { status: 'resolved', table } : { status: 'missing' };
  }
  const matches = index.byBase.get(normalized) ?? [];
  return matches.length === 1 ? { status: 'resolved', table: matches[0] } : { status: matches.length > 1 ? 'ambiguous' : 'missing' };
}

function buildDirectSelect(occurrence: Occurrence, predicateSql: string): string {
  const columns = captureColumnNames(occurrence);
  const projection = columns.length > 0 ? columns.map(quoteIdentifier).join(', ') : '*';
  if (predicateSql.includes('\n')) {
    return `select ${projection}\nfrom ${quoteRelation(occurrence.relationName)}\nwhere ${predicateSql};`;
  }
  return `select ${projection} from ${quoteRelation(occurrence.relationName)} where ${predicateSql};`;
}

function captureColumns(occurrence: Occurrence): FixtureExtractionCaptureColumns {
  const columns = captureColumnNames(occurrence);
  return columns.length > 0 ? { mode: 'ddl_columns', columnNames: columns } : { mode: 'all_columns' };
}

function captureColumnNames(occurrence: Occurrence): string[] {
  return occurrence.table ? Object.keys(occurrence.table.columns).sort(compareCodeUnits) : [];
}

function collectParameterNamesFromSql(sql: string): string[] {
  return collectParameterNamesFromAst(SqlParser.parse(sql));
}

function collectParameterNamesFromAst(statement: unknown): string[] {
  const names = new Set<string>();
  const seen = new Set<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value instanceof ParameterExpression) { names.add(rawValue(value.name)); return; }
    Object.values(value).forEach((nested) => Array.isArray(nested) ? nested.forEach(visit) : visit(nested));
  };
  visit(statement);
  return [...names].sort(compareCodeUnits);
}

function hasWildcard(statement: unknown): boolean {
  const seen = new Set<object>();
  const visit = (value: unknown): boolean => {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    if (value instanceof ColumnReference && identifierValue(value.column) === '*') return true;
    return Object.values(value).some((nested) => Array.isArray(nested) ? nested.some(visit) : visit(nested));
  };
  return visit(statement);
}

function hasUnsupportedInlineQuery(statement: unknown): boolean {
  const seen = new Set<object>();
  const visit = (value: unknown): boolean => {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    if (value instanceof UnaryExpression && value.expression instanceof InlineQuery) {
      const operator = rawValue(value.operator).toLowerCase();
      if (operator === 'exists' || operator === 'not exists') return visit(value.expression.selectQuery);
    }
    if (value instanceof InlineQuery) return true;
    return Object.values(value).some((nested) => Array.isArray(nested) ? nested.some(visit) : visit(nested));
  };
  return visit(statement);
}

function assignOccurrenceIds(occurrences: Occurrence[]): void {
  [...occurrences].sort((left, right) => compareCodeUnits(left.path, right.path)
    || compareCodeUnits(left.relationName, right.relationName)
    || compareCodeUnits(left.alias, right.alias))
    .forEach((occurrence, index) => { occurrence.occurrenceId = `relation-occurrence:${String(index + 1).padStart(4, '0')}`; });
}

function flattenAnd(value: unknown): unknown[] {
  const unwrapped = value instanceof ParenExpression ? value.expression : value;
  if (unwrapped instanceof BinaryExpression && rawValue(unwrapped.operator).toLowerCase() === 'and') {
    return [...flattenAnd(unwrapped.left), ...flattenAnd(unwrapped.right)];
  }
  return unwrapped ? [unwrapped] : [];
}

function unwrapExists(value: unknown): { notExists: boolean; query: SimpleSelectQuery | BinarySelectQuery } | undefined {
  const unwrapped = value instanceof ParenExpression ? value.expression : value;
  if (!(unwrapped instanceof UnaryExpression) || !(unwrapped.expression instanceof InlineQuery)) return undefined;
  const operator = rawValue(unwrapped.operator).toLowerCase();
  if (operator !== 'exists' && operator !== 'not exists') return undefined;
  const query = unwrapped.expression.selectQuery;
  return query instanceof SimpleSelectQuery || query instanceof BinarySelectQuery ? { notExists: operator === 'not exists', query } : undefined;
}

function unwrapSource(source: unknown): unknown {
  return source instanceof ParenSource ? unwrapSource(source.source) : source;
}

function tableSourceName(source: TableSource): string {
  return tableSourceSegments(source).join('.');
}

function tableSourceSegments(source: TableSource): string[] {
  return [...(source.namespaces?.map(identifierValue) ?? []), identifierValue(source.table)];
}

function referencesOccurrence(value: unknown, occurrence: Occurrence, aliases: Map<string, Occurrence>): boolean {
  const seen = new Set<object>();
  const visit = (item: unknown): boolean => {
    if (!item || typeof item !== 'object' || seen.has(item)) return false;
    seen.add(item);
    if (item instanceof ColumnReference) return resolveColumn(item, aliases)?.occurrence === occurrence;
    return Object.values(item).some((nested) => Array.isArray(nested) ? nested.some(visit) : visit(nested));
  };
  return visit(value);
}

function isUnknownDraft(draft: StepDraft): draft is UnknownDraft {
  return 'reasonCodes' in draft;
}

function draftHop(draft: StepDraft): number {
  return isUnknownDraft(draft) ? draft.attemptedHopCount : draft.hop;
}

function sortBlockedCodes(codes: readonly FixtureExtractionBlockedCode[]): FixtureExtractionBlockedCode[] {
  return [...new Set(codes)].sort((left, right) => BLOCKED_CATALOG[left].rank - BLOCKED_CATALOG[right].rank);
}

function rowsMayBePresent(): FixtureExtractionResultExpectation {
  return { kind: 'rows_may_be_present', note: null };
}

function emptyResultRequired(): FixtureExtractionResultExpectation {
  return { kind: 'empty_result_required', note: 'The required reproduction state may be an empty result for this relation.' };
}

function rawValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if ('value' in value && typeof value.value === 'string') return value.value;
    if ('name' in value && typeof value.name === 'string') return value.name;
  }
  return '';
}

function formatStaticLiteral(literal: LiteralValue): string | undefined {
  let candidate: string;
  if (literal.isStringLiteral) {
    if (typeof literal.value !== 'string'
      || literal.value.includes('\\')
      || /[\u0000-\u001f\u007f]/.test(literal.value)
      || !hasOnlyDoubledQuoteEscapes(literal.value)) return undefined;
    candidate = `'${literal.value}'`;
  } else if (literal.value === null) {
    candidate = 'null';
  } else if (typeof literal.value === 'boolean') {
    candidate = literal.value ? 'true' : 'false';
  } else if (typeof literal.value === 'number' && Number.isFinite(literal.value)) {
    candidate = String(literal.value);
  } else {
    return undefined;
  }
  try {
    const statement = SqlParser.parse(`select 1 where 1 = ${candidate}`);
    if (!(statement instanceof SimpleSelectQuery) || !(statement.whereClause?.condition instanceof BinaryExpression)) return undefined;
    const reparsed = statement.whereClause.condition.right;
    return reparsed instanceof LiteralValue
      && reparsed.value === literal.value
      && reparsed.isStringLiteral === literal.isStringLiteral
      ? candidate
      : undefined;
  } catch {
    return undefined;
  }
}

function hasOnlyDoubledQuoteEscapes(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "'") continue;
    if (value[index + 1] !== "'") return false;
    index += 1;
  }
  return true;
}

function identifierValue(value: unknown): string {
  return rawValue(value);
}

function normalizeIdentifier(value: string): string {
  return value.replace(/"/g, '').toLowerCase();
}

function baseRelationName(value: string): string {
  return value.split('.').at(-1) ?? value;
}

function relationMatches(left: string, right: string): boolean {
  const normalizedLeft = normalizeIdentifier(left);
  const normalizedRight = normalizeIdentifier(right);
  return normalizedLeft === normalizedRight || (!left.includes('.') && normalizeIdentifier(baseRelationName(right)) === normalizedLeft);
}

function foreignKeyTargets(reference: string, child: SchemaTableFacts, parent: SchemaTableFacts): boolean {
  const resolvedReference = reference.includes('.')
    ? reference
    : child.schemaName ? `${child.schemaName}.${reference}` : reference;
  return normalizeIdentifier(resolvedReference) === normalizeIdentifier(qualifiedTableName(parent));
}

function qualifiedTableName(table: SchemaTableFacts): string {
  return table.schemaName ? `${table.schemaName}.${table.name}` : table.name;
}

function isSameKey(left: readonly string[] | undefined, right: readonly string[]): boolean {
  return Boolean(left && left.length === right.length && left.every((column, index) => normalizeIdentifier(column) === normalizeIdentifier(right[index])));
}

function isTableUniqueKey(table: SchemaTableFacts, columns: readonly string[]): boolean {
  return columns.length > 0
    && columns.every((column) => tableHasColumn(table, column))
    && (isSameKey(table.primaryKey, columns) || (table.uniqueKeys ?? []).some((key) => isSameKey(key, columns)));
}

function tableHasColumn(table: SchemaTableFacts, column: string): boolean {
  const normalized = normalizeIdentifier(column);
  return Object.entries(table.columns).some(([columnKey, facts]) =>
    normalizeIdentifier(columnKey) === normalized && normalizeIdentifier(facts.name) === normalized);
}

function foreignKeyHasExistingColumns(
  foreignKey: SchemaForeignKeyFacts,
  child: SchemaTableFacts,
  parent: SchemaTableFacts,
): boolean {
  return foreignKey.columns.length > 0
    && foreignKey.columns.length === foreignKey.refColumns.length
    && foreignKey.columns.every((column) => tableHasColumn(child, column))
    && foreignKey.refColumns.every((column) => tableHasColumn(parent, column));
}

function quoteIdentifier(value: string): string {
  return /^[a-z_][a-z0-9_$]*$/.test(value) ? value : `"${value.replace(/"/g, '""')}"`;
}

function quoteRelation(value: string): string {
  return value.split('.').map(quoteIdentifier).join('.');
}
