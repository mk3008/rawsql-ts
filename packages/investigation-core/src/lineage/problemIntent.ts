import type { LineagePopulationEffect } from '../domain/lineage';

export type PopulationEffect = LineagePopulationEffect;

export type PopulationMechanism =
  | 'aggregate_filter'
  | 'aggregate'
  | 'case_when'
  | 'coalesce'
  | 'distinct'
  | 'distinct_on'
  | 'exists'
  | 'function_call'
  | 'group_by'
  | 'having'
  | 'join'
  | 'limit'
  | 'missing_distinct'
  | 'not_exists'
  | 'offset'
  | 'order_by'
  | 'union_all'
  | 'where'
  | 'window';

export type PopulationSignal =
  | 'distinct'
  | 'distinct_on'
  | 'group_by'
  | 'having'
  | 'join_xn'
  | 'limit'
  | 'order_by'
  | 'outer_join'
  | 'where';

export const populationSignalOrder = [
  'where',
  'having',
  'join_xn',
  'outer_join',
  'distinct',
  'distinct_on',
  'group_by',
  'limit',
  'order_by',
] as const satisfies readonly PopulationSignal[];

export type ProblemIntent =
  | 'all_signals'
  | 'logic_review'
  | 'duplicate_rows'
  | 'missing_rows'
  | 'value_missing'
  | 'value_too_high'
  | 'value_too_low';

export type DiagnosticProblemIntent = Exclude<ProblemIntent, 'all_signals' | 'logic_review'>;

export type CheckDomain =
  | 'data_condition'
  | 'program_logic'
  | 'schema_assumption';

export type DiagnosticConcernEffect =
  | PopulationEffect
  | 'aggregate_expression'
  | 'case_when'
  | 'exists'
  | 'function_call'
  | 'inner_join_filter'
  | 'left_join'
  | 'missing_distinct'
  | 'missing_match'
  | 'null_replacement'
  | 'source_data_value'
  | 'union_all'
  | 'unknown_or_not_implemented'
  | 'value_transform';

export const problemIntentOptions = [
  'all_signals',
  'logic_review',
  'value_too_high',
  'value_too_low',
  'value_missing',
  'missing_rows',
  'duplicate_rows',
] as const satisfies readonly ProblemIntent[];

export const diagnosticProblemIntents = [
  'value_too_high',
  'value_too_low',
  'value_missing',
  'missing_rows',
  'duplicate_rows',
] as const satisfies readonly DiagnosticProblemIntent[];

export const problemIntentLabels: Record<ProblemIntent, string> = {
  all_signals: 'All signals',
  logic_review: 'Logic review',
  duplicate_rows: 'Duplicate / too many rows',
  missing_rows: 'Missing / too few rows',
  value_missing: 'Missing / 0 / NULL value',
  value_too_high: 'Value too high',
  value_too_low: 'Value too low',
};

export const symptomEffectMap: Record<ProblemIntent, DiagnosticConcernEffect[]> = {
  all_signals: [
    'row_filter',
    'row_multiplication',
    'grain_change',
    'row_deduplication',
    'output_cap',
    'output_selection',
    'null_extension',
    'source_data_value',
  ],
  logic_review: [
    'aggregate_expression',
    'case_when',
    'function_call',
    'null_replacement',
    'value_transform',
  ],
  duplicate_rows: [
    'row_multiplication',
    'grain_change',
    'row_deduplication',
    'missing_distinct',
    'union_all',
  ],
  missing_rows: [
    'row_filter',
    'inner_join_filter',
    'exists',
    'row_deduplication',
    'output_cap',
    'output_selection',
  ],
  value_missing: [
    'row_filter',
    'missing_match',
    'null_extension',
    'output_cap',
    'output_selection',
    'null_replacement',
    'case_when',
    'left_join',
  ],
  value_too_high: [
    'row_multiplication',
    'grain_change',
    'aggregate_expression',
    'source_data_value',
    'value_transform',
  ],
  value_too_low: [
    'row_filter',
    'inner_join_filter',
    'output_cap',
    'output_selection',
    'grain_change',
    'null_extension',
    'null_replacement',
    'source_data_value',
  ],
};

export const symptomMechanismMap: Record<ProblemIntent, PopulationMechanism[]> = {
  all_signals: [
    'aggregate',
    'aggregate_filter',
    'case_when',
    'coalesce',
    'distinct',
    'distinct_on',
    'exists',
    'function_call',
    'group_by',
    'having',
    'join',
    'limit',
    'missing_distinct',
    'not_exists',
    'offset',
    'order_by',
    'union_all',
    'where',
    'window',
  ],
  logic_review: [
    'aggregate',
    'case_when',
    'coalesce',
    'function_call',
    'window',
  ],
  duplicate_rows: [
    'join',
    'group_by',
    'distinct',
    'distinct_on',
    'union_all',
    'missing_distinct',
  ],
  missing_rows: [
    'where',
    'exists',
    'not_exists',
    'join',
    'limit',
    'order_by',
    'distinct',
    'distinct_on',
  ],
  value_missing: [
    'join',
    'coalesce',
    'case_when',
    'where',
    'exists',
  ],
  value_too_high: [
    'join',
    'group_by',
    'aggregate',
    'union_all',
    'missing_distinct',
  ],
  value_too_low: [
    'where',
    'exists',
    'join',
    'group_by',
    'limit',
    'order_by',
    'coalesce',
  ],
};

export function isDiagnosticProblemIntent(value: ProblemIntent): value is DiagnosticProblemIntent {
  return value !== 'all_signals' && value !== 'logic_review';
}
