import { buildColumnDiagnosticPacket, type ColumnDiagnosticPacket, type ColumnTarget } from './diagnostics';
import { createInvestigationPlan, type InvestigationPlanV1, type InvestigationPlannerParametersV1 } from './investigationPlan';
import type { ProblemIntent } from './problemIntent';
import { analyzeSql } from './rawsqlAdapter';
import { parseSchemaFactsFromDdl, type DdlInput, type SchemaFacts } from './schemaFacts';

export interface ColumnLineageAnalysisInputV1 {
  /** Submitted SQL analyzed without rewriting or execution. */
  sql: string;
  /** A unique final output-column name. */
  targetColumn: string;
  ddl?: DdlInput[];
  parameters?: InvestigationPlannerParametersV1;
  schemaFacts?: SchemaFacts;
  symptom?: ProblemIntent;
}

export type ColumnLineageAnalysisInputErrorCode = 'DUPLICATE_OUTPUT_COLUMN' | 'TARGET_COLUMN_NOT_FOUND';

export class ColumnLineageAnalysisInputError extends Error {
  readonly code: ColumnLineageAnalysisInputErrorCode;

  constructor(code: ColumnLineageAnalysisInputErrorCode, targetColumn: string) {
    super(code === 'DUPLICATE_OUTPUT_COLUMN'
      ? `The final output contains more than one column named ${targetColumn}. Alias output columns uniquely before analysis.`
      : `The final output does not contain a column named ${targetColumn}.`);
    this.name = 'ColumnLineageAnalysisInputError';
    this.code = code;
  }
}

/**
 * A column-focused result with both lineage evidence and a static investigation plan.
 * Candidate concerns and suggested probes remain unconfirmed until a caller evaluates them.
 */
export interface ColumnLineageAnalysisV1 extends Omit<ColumnDiagnosticPacket, 'kind'> {
  analysisMode: 'original';
  investigationPlan: InvestigationPlanV1;
  kind: 'column-lineage-analysis';
  parserVersion: string;
}

export function analyzeColumnLineage(input: ColumnLineageAnalysisInputV1): ColumnLineageAnalysisV1 {
  const schemaFacts = input.schemaFacts ?? (input.ddl ? parseSchemaFactsFromDdl(input.ddl) : undefined);
  const { lineage, parserVersion } = analyzeSql(input.sql, {
    analysisMode: 'original',
    optimizeConditions: false,
    schemaFacts,
  });
  const target = resolveFinalOutputTarget(lineage.nodes.find((node) => node.id === 'main_output')?.columns ?? [], input.targetColumn);
  const packet = buildColumnDiagnosticPacket(lineage, target, { schemaFacts, ...(input.symptom ? { symptom: input.symptom } : {}) });
  const investigationPlan = createInvestigationPlan({
    sql: input.sql,
    target,
    ...(input.ddl ? { ddl: input.ddl } : {}),
    ...(input.parameters ? { parameters: input.parameters } : {}),
    ...(schemaFacts ? { schemaFacts } : {}),
    ...(input.symptom ? { symptom: input.symptom } : {}),
  });
  return {
    ...packet,
    analysisMode: 'original',
    investigationPlan,
    kind: 'column-lineage-analysis',
    parserVersion,
  };
}

function resolveFinalOutputTarget(columns: Array<{
  name: string;
  outputIndex?: number;
  scopeId?: string;
  selectItemId?: string;
  usage?: { role: 'condition' | 'filter' | 'unused' };
}>, targetColumn: string): ColumnTarget {
  const matches = columns.filter((column) => column.usage?.role !== 'filter' && column.name === targetColumn);
  if (matches.length === 0) throw new ColumnLineageAnalysisInputError('TARGET_COLUMN_NOT_FOUND', targetColumn);
  if (matches.length > 1) throw new ColumnLineageAnalysisInputError('DUPLICATE_OUTPUT_COLUMN', targetColumn);
  const column = matches[0];
  return {
    columnName: column.name,
    nodeId: 'main_output',
    ...(column.outputIndex !== undefined ? { outputIndex: column.outputIndex } : {}),
    ...(column.scopeId ? { scopeId: column.scopeId } : {}),
    ...(column.selectItemId ? { selectItemId: column.selectItemId } : {}),
  };
}
