export type LineageNodeType = 'table' | 'cte' | 'derived' | 'scalar_subquery' | 'parameter_table' | 'output';

export type LineageEdgeType = 'dataFlow' | 'expression' | 'unknown';
export type LineageEdgeKind = 'correlation' | 'join_condition' | 'predicate_subquery' | 'row_source' | 'subquery_value' | 'value_flow' | 'where_filter';

export interface LineageColumnRef {
  nodeId: string;
  columnName: string;
  scopeId?: string;
}

export type LineageUnresolvedColumnReferenceReason =
  | 'ambiguous_unqualified_column'
  | 'unknown_qualified_source'
  | 'unknown_unqualified_column';

export interface LineageUnresolvedColumnReference {
  candidateNodeIds?: string[];
  columnName: string;
  qualifier?: string;
  reason: LineageUnresolvedColumnReferenceReason;
  sql: string;
  suggestion: string;
}

export type LineageColumnUsageReason = 'join' | 'where' | 'having' | 'groupBy' | 'orderBy' | 'subquery';

export type LineageImpact =
  | 'may_filter_rows'
  | 'may_multiply_rows'
  | 'may_null_extend_rows'
  | 'may_change_grain'
  | 'may_change_value'
  | 'may_change_order'
  | 'may_limit_rows'
  | 'may_deduplicate_rows'
  | 'unknown';

export type LineagePopulationEffect =
  | 'grain_change'
  | 'null_extension'
  | 'output_cap'
  | 'output_selection'
  | 'row_deduplication'
  | 'row_filter'
  | 'row_multiplication';

export interface LineageNodeDependencyProfile {
  consumerNodeCount: number;
  consumerNodeIds: string[];
  hasGroupBy: boolean;
  hasHaving: boolean;
  hasJoin: boolean;
  hasLimit: boolean;
  hasOffset: boolean;
  hasOrderBy: boolean;
  hasSetOperation: boolean;
  hasWhere: boolean;
  inputNodeCount: number;
  inputNodeIds: string[];
  isRecursive: boolean;
  populationEffects: LineagePopulationEffect[];
  scopeIds: string[];
}

export interface LineageNodeQueryDependencies {
  directCteNames: string[];
  directTableNames: string[];
}

export interface SourceSpan {
  end?: number;
  start?: number;
}

export interface LineageSourceReference {
  columnName: string;
  nodeId: string;
  provenance?: 'anchor' | 'related';
  role?: 'row_lineage' | 'unknown' | 'column_lineage';
  scopeId: string;
}

export interface LineageCondition {
  existencePolarity?: 'exists' | 'not_exists';
  expressionSql: string;
  id: string;
  impact: LineageImpact[];
  kind: 'aggregate_filter' | 'case_when' | 'having' | 'join_on' | 'where';
  references: LineageSourceReference[];
  scopeId: string;
  sourceSpan?: SourceSpan;
  splitStrategy: 'none' | 'top_level_and' | 'unsupported_complex_expression' | 'whole_expression';
}

export interface LineageExpressionInfluence {
  expressionSql: string;
  id: string;
  impact: LineageImpact[];
  kind: 'distinct' | 'distinct_on' | 'group_by' | 'limit' | 'offset' | 'order_by' | 'window_order_by' | 'window_partition_by';
  references: LineageSourceReference[];
  scopeId: string;
  sourceSpan?: SourceSpan;
}

export interface LineageJoinInfluence {
  condition?: LineageCondition;
  id: string;
  impact: LineageImpact[];
  joinType: 'full' | 'inner' | 'left' | 'right' | 'unknown';
  references: LineageSourceReference[];
  scopeId: string;
  sourceNodeId: string;
}

export interface LineageDiagnostic {
  code: string;
  message: string;
  scopeId?: string;
  severity?: 'info' | 'warning';
}

export interface LineageScope {
  diagnostics?: LineageDiagnostic[];
  distinct?: LineageExpressionInfluence;
  distinctOn?: LineageExpressionInfluence[];
  groupBy?: LineageExpressionInfluence[];
  having?: LineageCondition[];
  id: string;
  joins?: LineageJoinInfluence[];
  kind: 'cte' | 'derived' | 'scalar_subquery' | 'select' | 'set_operation' | 'subquery';
  label?: string;
  nodeId: string;
  orderBy?: LineageExpressionInfluence[];
  parentScopeId?: string;
  limit?: LineageExpressionInfluence;
  offset?: LineageExpressionInfluence;
  where?: LineageCondition[];
  querySql?: string;
}

export interface LineageColumnUsage {
  role: 'condition' | 'filter' | 'unused';
  reasons?: LineageColumnUsageReason[];
}

export interface LineageCaseRule {
  id: string;
  label: string;
  caseLabel?: string;
  conditionSql?: string;
  expressionSql?: string;
  resultSql?: string;
  conditionUpstream: LineageColumnRef[];
  resultUpstream: LineageColumnRef[];
}

export type LineageExpressionTree =
  | {
      kind: 'column';
      ref: LineageColumnRef;
      sql: string;
    }
  | {
      kind: 'operator';
      operator: string;
      sql: string;
      children: LineageExpressionTree[];
      upstream: LineageColumnRef[];
    }
  | {
      kind: 'expression';
      sql: string;
      upstream: LineageColumnRef[];
    };

export interface LineageColumn {
  id: string;
  name: string;
  comments?: string[];
  caseRules?: LineageCaseRule[];
  expressionTree?: LineageExpressionTree;
  expressionSql?: string;
  outputIndex?: number;
  selectItemId?: string;
  scopeId?: string;
  upstream?: LineageColumnRef[];
  unresolvedUpstream?: LineageUnresolvedColumnReference[];
  usage?: LineageColumnUsage;
}

export interface LineageNode {
  id: string;
  type: LineageNodeType;
  label: string;
  columns: LineageColumn[];
  comments?: string[];
  cteExecutableSql?: string;
  dependencyProfile?: LineageNodeDependencyProfile;
  materializationHint?: 'MATERIALIZED' | 'NOT MATERIALIZED' | 'none';
  queryDependencies?: LineageNodeQueryDependencies;
  querySql?: string;
  recursive?: boolean;
  scalarSubquery?: {
    correlated: boolean;
    correlationConditions?: Array<{
      expressionSql: string;
      references: LineageSourceReference[];
      scopeId?: string;
    }>;
    outputExpressionSql?: string;
    ownerOutputColumnName: string;
    ownerOutputNodeId: string;
    ownerExpressionRole: 'whole_column' | 'expression_part';
    ownerExpressionPartIndex?: number;
    parentScopeId: string;
    scopeId?: string;
    sql?: string;
  };
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  type: LineageEdgeType;
  kind?: LineageEdgeKind;
  label?: string;
  sourceAlias?: string;
  joinNullability?: {
    reason: 'outerJoin';
    joinType: 'left' | 'right' | 'full';
  };
  recursive?: {
    reason: 'cteSelfReference';
  };
  confidence?: 'high' | 'medium' | 'low';
}

export interface AnalysisWarning {
  code: string;
  message: string;
  scopeId?: string;
}

export interface LineageModel {
  kind: 'sql-lineage-model';
  modelVersion: 1;
  nodes: LineageNode[];
  edges: LineageEdge[];
  scopes: LineageScope[];
  analysisWarnings: AnalysisWarning[];
  raw: {
    adapter: 'rawsql-ts-ast';
  };
}

export interface WorkspaceModel {
  kind: 'sql-lineage-workspace';
  schemaVersion: 1;
  modelVersion: 1;
  parserVersion: string;
  name: string;
  sql: string;
  lineage: LineageModel;
  view: {
    flowDirection: 'downstream' | 'upstream';
  };
}
