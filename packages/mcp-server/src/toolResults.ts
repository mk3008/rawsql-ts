import type {
  ColumnLineageAnalysisV1,
  FixtureExtractionPlan,
  QueryStructureAnalysisV1,
} from '@rawsql-ts/investigation-core';
import type { ConditionOptimizationResult } from 'rawsql-ts';
import {
  formatGeneratedSqlArtifact,
  generatedSqlArtifact,
  type ResolvedSqlFormatting,
} from './sqlFormatting';

/** Compact MCP transport view used to decide whether full structure detail is needed. */
export interface QueryStructureCompactViewV1 {
  analysisMode: QueryStructureAnalysisV1['analysisMode'];
  analysisWarnings: QueryStructureAnalysisV1['analysisWarnings'];
  cteNames: string[];
  derivedQueryCount: number;
  kind: 'query-structure-analysis-compact';
  operationSummaries: Array<{
    count: number;
    effects: string[];
    kind: string;
  }>;
  parserVersion: string;
  physicalTableNames: string[];
  scalarSubqueryCount: number;
  summary: QueryStructureAnalysisV1['summary'];
  version: 1;
  view: 'compact';
}

/** Compact MCP transport view used to decide whether full lineage detail is needed. */
export interface ColumnLineageCompactViewV1 {
  analysisMode: ColumnLineageAnalysisV1['analysisMode'];
  candidateConcerns: ColumnLineageAnalysisV1['candidateConcerns'];
  columnLineage: {
    sourceLeaves: ColumnLineageAnalysisV1['columnLineage']['sourceLeaves'];
    summary: ColumnLineageAnalysisV1['columnLineage']['summary'];
  };
  diagnostics: ColumnLineageAnalysisV1['diagnostics'];
  investigationSummary: {
    blockedProbeCount: number;
    deferredProbeCount: number;
    recommendedProbeCount: number;
    unresolvedParameterCount: number;
  };
  kind: 'column-lineage-analysis-compact';
  omittedContext: ColumnLineageAnalysisV1['omittedContext'];
  parserVersion: string;
  rowLineage: {
    influenceCount: number;
    nodeImpactCount: number;
    summary: string;
  };
  target: ColumnLineageAnalysisV1['target'];
  version: 1;
  view: 'compact';
}

export function toQueryStructureCompactView(result: QueryStructureAnalysisV1): QueryStructureCompactViewV1 {
  const operationSummaries = new Map<string, { count: number; effects: Set<string> }>();
  for (const operation of result.operations) {
    const summary = operationSummaries.get(operation.kind) ?? { count: 0, effects: new Set<string>() };
    summary.count += 1;
    operation.effects.forEach((effect) => summary.effects.add(effect));
    operationSummaries.set(operation.kind, summary);
  }
  return {
    analysisMode: result.analysisMode,
    analysisWarnings: result.analysisWarnings,
    cteNames: componentLabels(result, 'cte'),
    derivedQueryCount: result.summary.derivedQueryCount,
    kind: 'query-structure-analysis-compact',
    operationSummaries: [...operationSummaries.entries()]
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([kind, summary]) => ({
        count: summary.count,
        effects: [...summary.effects].sort(compareCodeUnits),
        kind,
      })),
    parserVersion: result.parserVersion,
    physicalTableNames: componentLabels(result, 'table'),
    scalarSubqueryCount: result.summary.scalarSubqueryCount,
    summary: result.summary,
    version: 1,
    view: 'compact',
  };
}

export function toColumnLineageCompactView(result: ColumnLineageAnalysisV1): ColumnLineageCompactViewV1 {
  const plan = result.investigationPlan;
  return {
    analysisMode: result.analysisMode,
    candidateConcerns: result.candidateConcerns,
    columnLineage: {
      sourceLeaves: result.columnLineage.sourceLeaves,
      summary: result.columnLineage.summary,
    },
    diagnostics: result.diagnostics,
    investigationSummary: {
      blockedProbeCount: plan.blockedProbes.length,
      deferredProbeCount: plan.deferredProbes.length,
      recommendedProbeCount: plan.recommendedProbes.length,
      unresolvedParameterCount: plan.unresolvedParameters.length,
    },
    kind: 'column-lineage-analysis-compact',
    omittedContext: result.omittedContext,
    parserVersion: result.parserVersion,
    rowLineage: {
      influenceCount: result.rowLineage.influences.length,
      nodeImpactCount: result.rowLineage.nodeImpacts.length,
      summary: result.rowLineage.summary,
    },
    target: result.target,
    version: 1,
    view: 'compact',
  };
}

export function formatFixtureExtractionPlan(
  plan: FixtureExtractionPlan,
  formatting: ResolvedSqlFormatting,
): FixtureExtractionPlan {
  return {
    ...plan,
    steps: plan.steps.map((step) => {
      if (step.artifactKind !== 'fixture_extraction_query' || step.sql === null) return step;
      const artifact = formatGeneratedSqlArtifact(
        generatedSqlArtifact(step.artifactKind, step.sql),
        formatting,
      );
      return { ...step, sql: artifact.sql };
    }),
  };
}

export function formatColumnLineageAnalysis(
  result: ColumnLineageAnalysisV1,
  formatting: ResolvedSqlFormatting,
): ColumnLineageAnalysisV1 {
  const formatProbe = <Probe extends ColumnLineageAnalysisV1['investigationPlan']['recommendedProbes'][number]>(
    probe: Probe,
  ): Probe => {
    const artifact = formatGeneratedSqlArtifact(
      generatedSqlArtifact(probe.artifactKind, probe.sql),
      formatting,
    );
    return { ...probe, sql: artifact.sql };
  };
  return {
    ...result,
    investigationPlan: {
      ...result.investigationPlan,
      deferredProbes: result.investigationPlan.deferredProbes.map(formatProbe),
      recommendedProbes: result.investigationPlan.recommendedProbes.map(formatProbe),
    },
  };
}

export function formatConditionOptimizationResult(
  result: ConditionOptimizationResult,
  formatting: ResolvedSqlFormatting,
): ConditionOptimizationResult {
  const sql = result.ok && result.query !== null
    ? formatGeneratedSqlArtifact(
        generatedSqlArtifact('condition_optimization_rewrite', result.sql),
        formatting,
      ).sql
    : result.sql;
  const diagnostics = result.diagnostics
    ? {
        ...result.diagnostics,
        ...(result.diagnostics.debugSql
          ? {
              debugSql: formatGeneratedSqlArtifact(
                generatedSqlArtifact('condition_optimization_debug_query', result.diagnostics.debugSql),
                formatting,
              ).sql,
            }
          : {}),
        probes: result.diagnostics.probes.map((probe) => ({
          ...probe,
          suggestedSql: formatGeneratedSqlArtifact(
            generatedSqlArtifact('source_filter_probe', probe.suggestedSql),
            formatting,
          ).sql,
        })),
      }
    : undefined;
  return { ...result, sql, diagnostics };
}

function componentLabels(
  result: QueryStructureAnalysisV1,
  kind: QueryStructureAnalysisV1['components'][number]['kind'],
): string[] {
  return [...new Set(result.components.filter((component) => component.kind === kind).map((component) => component.label))]
    .sort(compareCodeUnits);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
