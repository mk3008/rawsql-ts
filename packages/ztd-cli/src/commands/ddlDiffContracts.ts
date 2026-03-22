export type DdlDiffChangeKind =
  | 'create_table'
  | 'drop_table'
  | 'add_column'
  | 'drop_column'
  | 'alter_type'
  | 'alter_nullability'
  | 'table_rebuild'
  | 'schema_change';

export interface DdlDiffSummaryEntry {
  schema: string;
  table: string;
  changeKind: DdlDiffChangeKind;
  details: Record<string, unknown>;
}

export type RiskGuidanceKind =
  | 'review_if_required'
  | 'avoid_if_possible'
  | 'cli_option_not_exposed';

export type DestructiveRiskKind =
  | 'drop_table'
  | 'drop_column'
  | 'cascade_drop'
  | 'alter_type'
  | 'rename_candidate'
  | 'nullability_tighten'
  | 'semantic_constraint_change';

export type OperationalRiskKind =
  | 'table_rebuild'
  | 'index_rebuild'
  | 'full_table_copy';

export interface DestructiveRisk {
  kind: DestructiveRiskKind;
  target?: string;
  from?: string;
  to?: string;
  avoidable?: boolean;
  guidance?: RiskGuidanceKind[];
}

export interface OperationalRisk {
  kind: OperationalRiskKind;
  target: string;
}

export interface DdlDiffRisks {
  destructiveRisks: DestructiveRisk[];
  operationalRisks: OperationalRisk[];
}

export interface DdlDiffArtifacts {
  sql: string;
  text: string;
  json: string;
}

export type ApplyPlanOperationKind =
  | 'emit_schema_statement'
  | 'drop_table_cascade'
  | 'create_table'
  | 'recreate_table'
  | 'reapply_statement'
  | 'drop_column_effect'
  | 'alter_type_effect'
  | 'nullability_tighten_effect'
  | 'rename_candidate_effect'
  | 'semantic_constraint_change_effect'
  | 'index_rebuild_effect';

export interface ApplyPlanOperation {
  kind: ApplyPlanOperationKind;
  target?: string;
  from?: string;
  to?: string;
  sql?: string;
  statementKind?: 'index' | 'other';
}

export interface DdlApplyPlan {
  operations: ApplyPlanOperation[];
}
