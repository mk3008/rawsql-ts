import type { DdlInput, SchemaFacts } from '../schemaFacts';

export interface FixtureExtractionInput {
  readonly sql: string;
  readonly ddl?: readonly DdlInput[];
  readonly schemaFacts?: SchemaFacts;
  /**
   * Optional low-level override for callers that already possess reviewed
   * metadata. The public MCP contract derives this from static SQL and schema
   * facts instead of accepting it as an argument.
   */
  readonly reproductionKey?: FixtureExtractionReproductionKeyInput;
}

export interface FixtureExtractionReproductionKeyInput {
  readonly parameterNames: readonly string[];
  readonly rootRelation?: string;
  readonly rootColumns?: readonly string[];
}

export type FixtureExtractionInputErrorCode =
  | 'INPUT_SHAPE_INVALID'
  | 'VALUE_BEARING_INPUT_FORBIDDEN';

export class FixtureExtractionInputError extends Error {
  readonly code: FixtureExtractionInputErrorCode;

  constructor(code: FixtureExtractionInputErrorCode) {
    super(code === 'VALUE_BEARING_INPUT_FORBIDDEN'
      ? 'Value-bearing input is forbidden for fixture extraction.'
      : 'Fixture extraction input has an invalid shape.');
    this.name = 'FixtureExtractionInputError';
    this.code = code;
  }
}

export type FixtureExtractionPlanStatus = 'ready' | 'partial' | 'blocked';

export type FixtureExtractionBlockedCode =
  | 'SQL_PARSE_UNSUPPORTED'
  | 'DML_STATEMENT_UNSUPPORTED'
  | 'RETURNING_UNSUPPORTED'
  | 'DML_CTE_UNSUPPORTED'
  | 'RECURSIVE_CTE_UNSUPPORTED'
  | 'ENVIRONMENT_STATE_UNSUPPORTED'
  | 'VOLATILE_SOURCE_UNSUPPORTED'
  | 'ANALYSIS_RESOURCE_LIMIT'
  | 'UNRESOLVED_WILDCARD'
  | 'ROOT_RELATION_UNRESOLVED'
  | 'RELATION_UNRESOLVED'
  | 'COLUMN_REFERENCE_AMBIGUOUS'
  | 'REPRODUCTION_KEY_REQUIRED'
  | 'REPRODUCTION_KEY_AMBIGUOUS'
  | 'SCHEMA_FACTS_REQUIRED'
  | 'FOREIGN_KEY_AMBIGUOUS'
  | 'RELATIONSHIP_CYCLE_UNSUPPORTED'
  | 'NON_EQUALITY_JOIN_UNSUPPORTED'
  | 'JOIN_BOUNDARY_UNPROVEN'
  | 'PARAMETER_PROPAGATION_UNPROVEN'
  | 'CAPTURE_BOUNDARY_UNBOUNDED';

export type FixtureExtractionRequiredFact =
  | 'function volatility metadata'
  | 'missing foreign key'
  | 'reviewed logical foreign key'
  | 'relation identity'
  | 'root key column'
  | 'schema columns'
  | 'static SQL text'
  | 'transaction-independent semantics';

/**
 * Schema version 0 deliberately marks this as an internal, experimental contract.
 * Keep it at 0 while breaking shape or semantic changes are expected during the
 * fixture-extraction investigation. Promote it to 1 only when the contract is
 * intentionally adopted by a long-lived consumer and its compatibility policy,
 * migration expectations, documentation, and contract tests are all established.
 * This is independent of the library package version.
 */
export const FIXTURE_EXTRACTION_PLAN_SCHEMA_VERSION = 0 as const;

export interface FixtureExtractionPlan {
  readonly kind: 'fixture-extraction-plan';
  readonly schemaVersion: typeof FIXTURE_EXTRACTION_PLAN_SCHEMA_VERSION;
  readonly status: FixtureExtractionPlanStatus;
  readonly source: FixtureExtractionSource;
  readonly reproductionKey: FixtureExtractionReproductionKey;
  readonly sourceEvidence: readonly FixtureExtractionSourceEvidence[];
  readonly steps: readonly FixtureExtractionStep[];
  readonly suggestedCaptureOrder: readonly string[];
  readonly suggestedLoadOrder: readonly string[];
  readonly blockedReasons: readonly FixtureExtractionBlockedReason[];
  readonly limitations: readonly FixtureExtractionLimitation[];
}

export interface FixtureExtractionSource {
  readonly analysisMode: 'original';
  readonly hashAlgorithm: 'sha256';
  readonly sqlHash: string;
}

export interface FixtureExtractionReproductionKey {
  /** A key equality proves one entity; a predicate may intentionally capture many rows. */
  readonly boundaryKind?: 'key_equality' | 'parameter_predicate';
  readonly parameterNames: readonly string[];
  readonly rootRelation?: string;
  readonly rootRelationOccurrenceId?: string;
  readonly rootColumns: readonly string[];
  readonly columnParameterMappings: readonly FixtureExtractionColumnParameterMapping[];
  readonly sourceEvidenceIds: readonly string[];
  readonly status: 'resolved' | 'ambiguous' | 'blocked';
}

export interface FixtureExtractionColumnParameterMapping {
  readonly parameterName: string;
  readonly rootColumn: string;
}

export type FixtureExtractionSourceEvidenceKind =
  | 'parser_ast'
  | 'lineage_node'
  | 'lineage_edge'
  | 'lineage_scope'
  | 'where_condition'
  | 'join_condition'
  | 'exists_condition'
  | 'schema_table'
  | 'schema_primary_key'
  | 'schema_unique_key'
  | 'schema_foreign_key'
  | 'schema_declared_logical_foreign_key'
  | 'schema_diagnostic';

export interface FixtureExtractionSourceEvidence {
  readonly id: string;
  readonly kind: FixtureExtractionSourceEvidenceKind;
  readonly sourceId: string;
  readonly sourcePath?: string;
}

export type FixtureExtractionPredicateDerivation =
  | 'root_predicate'
  | 'join_key_propagation'
  | 'exists_dependency'
  | 'foreign_key_dependency';

export interface FixtureExtractionStepBase {
  readonly id: string;
  readonly relationName: string;
  readonly relationOccurrenceId: string;
  readonly artifactKind: 'fixture_extraction_query';
  readonly dependsOnStepIds: readonly string[];
  readonly loadAfterStepIds: readonly string[];
  readonly predicateDerivation: FixtureExtractionPredicateDerivation;
  readonly sourceEvidenceIds: readonly string[];
  readonly captureColumns: FixtureExtractionCaptureColumns;
  readonly resultExpectation: FixtureExtractionResultExpectation;
}

export interface FixtureExtractionBoundedStep extends FixtureExtractionStepBase {
  readonly sql: string;
  readonly parameterNames: readonly string[];
  readonly boundary: FixtureExtractionBoundedBoundary;
  readonly blockedReasonCodes: readonly [];
}

export interface FixtureExtractionUnknownStep extends FixtureExtractionStepBase {
  readonly sql: null;
  readonly parameterNames: readonly string[];
  readonly boundary: FixtureExtractionUnknownBoundary;
  readonly blockedReasonCodes: readonly FixtureExtractionBlockedCode[];
}

export type FixtureExtractionStep = FixtureExtractionBoundedStep | FixtureExtractionUnknownStep;

export interface FixtureExtractionBoundedBoundary {
  readonly status: 'bounded';
  readonly reason:
    | 'root_key_parameter_equality'
    | 'root_parameter_predicate'
    | 'direct_key_equality_propagation'
    | 'correlated_exists_key_equality'
    | 'nested_foreign_key_subquery';
  readonly hopCount: number;
  readonly relationColumns: readonly string[];
  readonly parameterNames: readonly string[];
  readonly sourceEvidenceIds: readonly string[];
}

export interface FixtureExtractionUnknownBoundary {
  readonly status: 'unknown';
  readonly reason: 'unproven';
  readonly attemptedHopCount?: number;
  readonly reasonCodes: readonly FixtureExtractionBlockedCode[];
  readonly sourceEvidenceIds: readonly string[];
}

export type FixtureExtractionBoundary = FixtureExtractionBoundedBoundary | FixtureExtractionUnknownBoundary;

export type FixtureExtractionCaptureColumns =
  | { readonly mode: 'all_columns' }
  | { readonly mode: 'ddl_columns'; readonly columnNames: readonly string[] };

export type FixtureExtractionResultExpectation =
  | { readonly kind: 'rows_may_be_present'; readonly note: null }
  | {
    readonly kind: 'empty_result_required';
    readonly note: 'The required reproduction state may be an empty result for this relation.';
  };

export interface FixtureExtractionBlockedReason {
  readonly code: FixtureExtractionBlockedCode;
  readonly message: string;
  readonly requiredFacts: readonly FixtureExtractionRequiredFact[];
  readonly sourceEvidenceIds: readonly string[];
  readonly affectedStepIds: readonly string[];
}

export type FixtureExtractionLimitationCode =
  | 'STATIC_ONLY_NO_EXECUTION'
  | 'SENSITIVE_COLUMN_POLICY_NOT_EVALUATED'
  | 'GENERATED_IDENTITY_LOADING_OUTSIDE_POC'
  | 'LARGE_OBJECT_MIGRATION_OUTSIDE_POC'
  | 'ROOT_PREDICATE_MAY_CAPTURE_MULTIPLE_ROWS'
  | 'PARTIAL_PLAN_INCOMPLETE';

export interface FixtureExtractionLimitation {
  readonly code: FixtureExtractionLimitationCode;
  readonly message: string;
  readonly appliesToStepIds: readonly string[];
}

/** Produces the contract's canonical, code-unit-ordered JSON representation. */
export function canonicalFixtureExtractionPlanJson(plan: FixtureExtractionPlan): string {
  return JSON.stringify(sortCanonicalValue(plan));
}

function sortCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value as Record<string, unknown>)
    .sort(compareCodeUnits)
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .map((key) => [key, sortCanonicalValue((value as Record<string, unknown>)[key])]));
}

export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
