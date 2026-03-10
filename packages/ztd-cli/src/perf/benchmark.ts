import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ensurePgModule } from '../utils/optionalDependencies';
import { bindModelGenNamedSql } from '../utils/modelGenBinder';
import { scanModelGenSql, type PlaceholderMode } from '../utils/modelGenScanner';
import { buildQueryStructureReport } from '../query/structure';
import { findScalarFilterCandidates } from '../query/scalarFilterAnalysis';
import { loadPerfSandboxConfig, ensurePerfConnection, type PerfSeedConfig, loadPerfSeedConfig } from './sandbox';

export type PerfBenchmarkMode = 'auto' | 'latency' | 'completion';
export type PerfSelectedBenchmarkMode = 'latency' | 'completion';
export type PerfBenchmarkFormat = 'text' | 'json';
export type PerfExecutionStrategy = 'direct';
export type PerfRecommendedActionName =
  | 'consider-pipeline-materialization'
  | 'review-index-coverage'
  | 'inspect-join-strategy'
  | 'stabilize-completion-run'
  | 'consider-scalar-filter-binding';

export interface PerfRunOptions {
  rootDir: string;
  queryFile: string;
  paramsFile?: string;
  mode: PerfBenchmarkMode;
  repeat: number;
  warmup: number;
  classifyThresholdSeconds: number;
  timeoutMinutes: number;
  save: boolean;
  dryRun: boolean;
  label?: string;
}

export interface PerfStatementReport {
  seq: number;
  role: 'final-query';
  sql: string;
  bindings: unknown[] | Record<string, unknown> | undefined;
  resolved_sql_preview?: string;
  row_count?: number;
  elapsed_ms?: number;
  timed_out?: boolean;
  plan_summary?: PerfPlanSummary | null;
  sql_file?: string;
  resolved_sql_preview_file?: string;
  plan_file?: string;
}

export interface PerfPlanSummary {
  node_type?: string;
  join_type?: string;
  total_cost?: number;
  plan_rows?: number;
  actual_rows?: number;
  actual_total_time?: number;
}

export interface PerfPipelineCandidate {
  name: string;
  downstream_references: number;
  reasons: string[];
}

export interface PerfPipelineAnalysis {
  query_type: string;
  cte_count: number;
  should_consider_pipeline: boolean;
  candidate_ctes: PerfPipelineCandidate[];
  scalar_filter_candidates: string[];
  notes: string[];
}

export interface PerfRecommendedAction {
  action: PerfRecommendedActionName;
  priority: 'high' | 'medium';
  rationale: string;
}

export interface PerfClassificationProbe {
  elapsed_ms: number;
  timed_out: boolean;
  row_count?: number;
  reused_as_warmup?: boolean;
  reused_as_measured_run?: boolean;
}

export interface PerfPlanDelta {
  statement_id: string;
  baseline_plan: string;
  candidate_plan: string;
  changed: boolean;
}

interface PerfPlanFacts {
  observations: string[];
  statement_summary: string;
  hasSequentialScan: boolean;
  hasJoin: boolean;
}

export interface PerfBenchmarkReport {
  schema_version: 1;
  command: 'perf run';
  run_id?: string;
  label?: string;
  query_file: string;
  query_type: 'SELECT';
  params_file?: string;
  params_shape: PlaceholderMode;
  ordered_param_names: string[];
  source_sql_file: string;
  source_sql: string;
  bound_sql: string;
  bindings: unknown[] | Record<string, unknown> | undefined;
  strategy: PerfExecutionStrategy;
  requested_mode: PerfBenchmarkMode;
  selected_mode: PerfSelectedBenchmarkMode;
  selection_reason: string;
  classify_threshold_ms: number;
  timeout_ms: number;
  database_version?: string;
  dry_run: boolean;
  saved: boolean;
  evidence_dir?: string;
  classification_probe?: PerfClassificationProbe;
  total_elapsed_ms?: number;
  latency_metrics?: {
    measured_runs: number;
    warmup_runs: number;
    min_ms: number;
    max_ms: number;
    avg_ms: number;
    median_ms: number;
    p95_ms: number;
  };
  completion_metrics?: {
    completed: boolean;
    timed_out: boolean;
    wall_time_ms: number;
  };
  executed_statements: PerfStatementReport[];
  plan_summary?: PerfPlanSummary | null;
  plan_observations: string[];
  recommended_actions: PerfRecommendedAction[];
  pipeline_analysis: PerfPipelineAnalysis;
  seed?: Pick<PerfSeedConfig, 'seed'>;
}

export interface PerfDiffReport {
  schema_version: 1;
  command: 'perf report diff';
  baseline_run_id?: string;
  candidate_run_id?: string;
  baseline_mode: PerfSelectedBenchmarkMode;
  candidate_mode: PerfSelectedBenchmarkMode;
  baseline_strategy: PerfExecutionStrategy;
  candidate_strategy: PerfExecutionStrategy;
  primary_metric: {
    name: 'p95_ms' | 'wall_time_ms' | 'total_elapsed_ms';
    baseline: number;
    candidate: number;
    improvement_percent: number;
  };
  mode_changed: boolean;
  statements_delta: number;
  plan_deltas: PerfPlanDelta[];
  notes: string[];
}

interface PreparedBenchmarkQuery {
  absolutePath: string;
  sourceSql: string;
  boundSql: string;
  queryType: 'SELECT';
  paramsShape: PlaceholderMode;
  orderedParamNames: string[];
  bindings: unknown[] | Record<string, unknown> | undefined;
}

interface DirectExecutionResult {
  elapsedMs: number;
  rowCount?: number;
  timedOut: boolean;
}

interface PerfSelectionResult {
  selectedMode: PerfSelectedBenchmarkMode;
  reason: string;
  probe?: DirectExecutionResult;
}

const DEFAULT_REPEAT = 10;
const DEFAULT_WARMUP = 3;
const DEFAULT_CLASSIFY_THRESHOLD_SECONDS = 60;
const DEFAULT_TIMEOUT_MINUTES = 5;

function assertValidPerfRunOptions(options: PerfRunOptions): void {
  const issues: string[] = [];

  if (!Number.isInteger(options.repeat) || options.repeat <= 0) {
    issues.push('repeat must be a positive integer');
  }
  if (!Number.isInteger(options.warmup) || options.warmup < 0) {
    issues.push('warmup must be a non-negative integer');
  }
  if (!Number.isFinite(options.timeoutMinutes) || options.timeoutMinutes <= 0) {
    issues.push('timeoutMinutes must be greater than 0');
  }
  if (!Number.isFinite(options.classifyThresholdSeconds) || options.classifyThresholdSeconds <= 0) {
    issues.push('classifyThresholdSeconds must be greater than 0');
  }

  if (issues.length > 0) {
    throw new Error('invalid perf options: ' + issues.join('; '));
  }
}

/**
 * Execute or plan a direct SQL benchmark against the perf sandbox.
 */
export async function runPerfBenchmark(options: PerfRunOptions): Promise<PerfBenchmarkReport> {
  assertValidPerfRunOptions(options);

  const prepared = prepareBenchmarkQuery(options.rootDir, options.queryFile, options.paramsFile);
  const pipelineAnalysis = buildPerfPipelineAnalysis(prepared.absolutePath);
  const classifyThresholdMs = options.classifyThresholdSeconds * 1000;
  const timeoutMs = options.timeoutMinutes * 60 * 1000;
  const seedConfig = loadPerfSeedConfig(options.rootDir);
  const databaseVersion = options.dryRun ? undefined : await fetchPerfDatabaseVersion(options.rootDir);

  const selection: PerfSelectionResult = options.dryRun
    ? {
        selectedMode: options.mode === 'auto' ? 'completion' : options.mode,
        reason: options.mode === 'auto'
          ? 'dry-run skips live auto classification; the real run will pick latency or completion after a thresholded probe'
          : 'mode forced by user'
      }
    : options.mode === 'auto'
    ? await classifyPerfBenchmarkMode(options.rootDir, prepared, classifyThresholdMs)
    : {
        selectedMode: options.mode,
        reason: 'mode forced by user'
      };

  if (options.dryRun) {
    const dryRunStatements: PerfStatementReport[] = [
      {
        seq: 1,
        role: 'final-query',
        sql: prepared.boundSql,
        bindings: prepared.bindings,
        resolved_sql_preview: renderResolvedSqlPreview(prepared.boundSql, prepared.bindings)
      }
    ];

    return {
      schema_version: 1,
      command: 'perf run',
      query_file: prepared.absolutePath,
      query_type: prepared.queryType,
      params_file: options.paramsFile ? path.resolve(options.rootDir, options.paramsFile) : undefined,
      params_shape: prepared.paramsShape,
      ordered_param_names: prepared.orderedParamNames,
      source_sql_file: prepared.absolutePath,
      source_sql: prepared.sourceSql,
      bound_sql: prepared.boundSql,
      bindings: prepared.bindings,
      strategy: 'direct',
      requested_mode: options.mode,
      selected_mode: selection.selectedMode,
      selection_reason: selection.reason,
      classify_threshold_ms: classifyThresholdMs,
      timeout_ms: timeoutMs,
      database_version: databaseVersion,
      dry_run: true,
      saved: false,
      classification_probe: selection.probe ? toPerfClassificationProbe(selection.probe) : undefined,
      executed_statements: dryRunStatements,
      plan_observations: [],
      recommended_actions: buildPerfRecommendedActions(selection.selectedMode, true, pipelineAnalysis, {
        observations: [],
        statement_summary: '(no plan captured)',
        hasSequentialScan: false,
        hasJoin: false
      }),
      pipeline_analysis: pipelineAnalysis,
      seed: { seed: seedConfig.seed }
    };
  }

  const latencyRuns: number[] = [];
  let representativeExecution: DirectExecutionResult | undefined;
  let representativePlan: unknown = null;
  let classificationProbe = selection.probe ? toPerfClassificationProbe(selection.probe) : undefined;

  if (selection.selectedMode === 'latency') {
    let remainingWarmups = options.warmup;
    let remainingMeasuredRuns = options.repeat;

    // Reuse the auto-classification probe so the benchmark does not hide an extra live query.
    if (selection.probe) {
      if (selection.probe.timedOut) {
        throw new Error('Latency benchmark classification probe timed out unexpectedly. Re-run with --mode completion or a larger timeout.');
      }
      if (remainingWarmups > 0) {
        remainingWarmups -= 1;
        classificationProbe = {
          ...toPerfClassificationProbe(selection.probe),
          reused_as_warmup: true
        };
      } else if (remainingMeasuredRuns > 0) {
        remainingMeasuredRuns -= 1;
        latencyRuns.push(selection.probe.elapsedMs);
        representativeExecution = selection.probe;
        classificationProbe = {
          ...toPerfClassificationProbe(selection.probe),
          reused_as_measured_run: true
        };
      }
    }

    for (let index = 0; index < remainingWarmups; index += 1) {
      const warmupExecution = await executeDirectBenchmarkOnce(options.rootDir, prepared, timeoutMs);
      if (warmupExecution.timedOut) {
        throw new Error('Latency benchmark timed out during warmup. Re-run with --mode completion or a larger timeout.');
      }
    }

    for (let index = 0; index < remainingMeasuredRuns; index += 1) {
      const execution = await executeDirectBenchmarkOnce(options.rootDir, prepared, timeoutMs);
      if (execution.timedOut) {
        throw new Error('Latency benchmark timed out during a measured run. Re-run with --mode completion or a larger timeout.');
      }
      latencyRuns.push(execution.elapsedMs);
      if (!representativeExecution) {
        representativeExecution = execution;
      }
    }

    representativePlan = await captureDirectPlan(options.rootDir, prepared, timeoutMs, true);
  } else {
    // Reuse the auto-classification probe when it already completed the long-running query.
    if (selection.probe && !selection.probe.timedOut) {
      representativeExecution = selection.probe;
      classificationProbe = {
        ...toPerfClassificationProbe(selection.probe),
        reused_as_measured_run: true
      };
    } else {
      representativeExecution = await executeDirectBenchmarkOnce(options.rootDir, prepared, timeoutMs);
    }
    representativePlan = await captureDirectPlan(options.rootDir, prepared, timeoutMs, !representativeExecution.timedOut);
  }

  const executedStatements: PerfStatementReport[] = [
    {
      seq: 1,
      role: 'final-query',
      sql: prepared.boundSql,
      bindings: prepared.bindings,
      resolved_sql_preview: renderResolvedSqlPreview(prepared.boundSql, prepared.bindings),
      row_count: representativeExecution?.rowCount,
      elapsed_ms: representativeExecution?.elapsedMs,
      timed_out: representativeExecution?.timedOut,
      plan_summary: summarizePlanJson(representativePlan)
    }
  ];

  const planFacts = buildPerfPlanFacts(representativePlan);

  const report: PerfBenchmarkReport = {
    schema_version: 1,
    command: 'perf run',
    query_file: prepared.absolutePath,
    query_type: prepared.queryType,
    params_file: options.paramsFile ? path.resolve(options.rootDir, options.paramsFile) : undefined,
    params_shape: prepared.paramsShape,
    ordered_param_names: prepared.orderedParamNames,
    source_sql_file: prepared.absolutePath,
    source_sql: prepared.sourceSql,
    bound_sql: prepared.boundSql,
    bindings: prepared.bindings,
    strategy: 'direct',
    requested_mode: options.mode,
    selected_mode: selection.selectedMode,
    selection_reason: selection.reason,
    classify_threshold_ms: classifyThresholdMs,
    timeout_ms: timeoutMs,
    database_version: databaseVersion,
    dry_run: false,
    saved: false,
    classification_probe: classificationProbe,
    total_elapsed_ms: selection.selectedMode === 'latency'
      ? latencyRuns.reduce((sum, value) => sum + value, 0)
      : representativeExecution?.elapsedMs,
    latency_metrics: selection.selectedMode === 'latency'
      ? buildLatencyMetrics(latencyRuns, options.warmup)
      : undefined,
    completion_metrics: selection.selectedMode === 'completion' && representativeExecution
      ? {
          completed: !representativeExecution.timedOut,
          timed_out: representativeExecution.timedOut,
          wall_time_ms: representativeExecution.elapsedMs
        }
      : undefined,
    executed_statements: executedStatements,
    plan_summary: summarizePlanJson(representativePlan),
    plan_observations: planFacts.observations,
    recommended_actions: buildPerfRecommendedActions(
      selection.selectedMode,
      !representativeExecution?.timedOut,
      pipelineAnalysis,
      planFacts
    ),
    pipeline_analysis: pipelineAnalysis,
    seed: { seed: seedConfig.seed }
  };

  if (options.save) {
    const persisted = savePerfBenchmarkEvidence(options.rootDir, report, representativePlan);
    report.run_id = persisted.runId;
    report.evidence_dir = persisted.evidenceDir;
    report.saved = true;
    report.executed_statements = report.executed_statements.map((statement, index) => ({
      ...statement,
      sql_file: persisted.sqlFiles[index] || undefined,
      resolved_sql_preview_file: persisted.resolvedSqlPreviewFiles[index] || undefined,
      plan_file: persisted.planFiles[index] || undefined
    }));
  }

  return report;
}

/**
 * Compare two saved benchmark evidence directories for AI-friendly tuning decisions.
 */
export function diffPerfBenchmarkReports(baselineDir: string, candidateDir: string): PerfDiffReport {
  const baseline = loadPerfBenchmarkReport(baselineDir);
  const candidate = loadPerfBenchmarkReport(candidateDir);
  const notes: string[] = [];
  const modeChanged = baseline.selected_mode !== candidate.selected_mode;
  const statementsDelta = candidate.executed_statements.length - baseline.executed_statements.length;
  const planDeltas = buildPerfPlanDeltas(baseline, candidate);

  let metricName: 'p95_ms' | 'wall_time_ms' | 'total_elapsed_ms' = 'total_elapsed_ms';
  let baselineMetric = baseline.total_elapsed_ms ?? 0;
  let candidateMetric = candidate.total_elapsed_ms ?? 0;

  if (baseline.selected_mode === 'latency' && candidate.selected_mode === 'latency') {
    metricName = 'p95_ms';
    baselineMetric = baseline.latency_metrics?.p95_ms ?? baseline.total_elapsed_ms ?? 0;
    candidateMetric = candidate.latency_metrics?.p95_ms ?? candidate.total_elapsed_ms ?? 0;
    notes.push('Compared latency-mode p95 because both runs are repeat benchmarks.');
  } else if (baseline.selected_mode === 'completion' && candidate.selected_mode === 'completion') {
    metricName = 'wall_time_ms';
    baselineMetric = baseline.completion_metrics?.wall_time_ms ?? baseline.total_elapsed_ms ?? 0;
    candidateMetric = candidate.completion_metrics?.wall_time_ms ?? candidate.total_elapsed_ms ?? 0;
    notes.push('Compared completion wall time because both runs are long-running benchmarks.');
  } else {
    notes.push('Modes differ, so diff falls back to total elapsed time instead of p95.');
  }

  if (modeChanged) {
    notes.push(`Mode changed from ${baseline.selected_mode} to ${candidate.selected_mode}.`);
  }

  if (baseline.pipeline_analysis.should_consider_pipeline || candidate.pipeline_analysis.should_consider_pipeline) {
    notes.push('Pipeline candidacy is present in at least one run; inspect candidate_ctes before rewriting SQL.');
  }
  if ((baseline.pipeline_analysis.scalar_filter_candidates?.length ?? 0) > 0 || (candidate.pipeline_analysis.scalar_filter_candidates?.length ?? 0) > 0) {
    notes.push('Scalar filter binding candidates are present; inspect scalar_filter_candidates before keeping optimizer-sensitive subqueries inline.');
  }
  if (baseline.database_version && candidate.database_version && baseline.database_version !== candidate.database_version) {
    notes.push(`Database version changed from ${baseline.database_version} to ${candidate.database_version}.`);
  }
  const candidateActions = candidate.recommended_actions ?? [];
  if (candidateActions.length > 0) {
    notes.push('Candidate recommended actions: ' + candidateActions.map((action) => action.action).join(', '));
  }
  return {
    schema_version: 1,
    command: 'perf report diff',
    baseline_run_id: baseline.run_id,
    candidate_run_id: candidate.run_id,
    baseline_mode: baseline.selected_mode,
    candidate_mode: candidate.selected_mode,
    baseline_strategy: baseline.strategy,
    candidate_strategy: candidate.strategy,
    primary_metric: {
      name: metricName,
      baseline: baselineMetric,
      candidate: candidateMetric,
      improvement_percent: calculateImprovementPercent(baselineMetric, candidateMetric)
    },
    mode_changed: modeChanged,
    statements_delta: statementsDelta,
    plan_deltas: planDeltas,
    notes
  };
}

/**
 * Render a benchmark report in either text or JSON for humans and agents.
 */
export function formatPerfBenchmarkReport(report: PerfBenchmarkReport, format: PerfBenchmarkFormat): string {
  if (format === 'json') {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  const lines = [
    `Query: ${report.query_file}`,
    `Mode: ${report.selected_mode} (requested: ${report.requested_mode})`,
    `Selection: ${report.selection_reason}`,
    `Strategy: ${report.strategy}`,
    `Timeout: ${Math.round(report.timeout_ms / 1000)}s`,
    `Statements: ${report.executed_statements.length}`,
  ];

  if (report.latency_metrics) {
    lines.push(`Measured runs: ${report.latency_metrics.measured_runs}`);
    lines.push(`avg: ${report.latency_metrics.avg_ms.toFixed(2)} ms`);
    lines.push(`median: ${report.latency_metrics.median_ms.toFixed(2)} ms`);
    lines.push(`p95: ${report.latency_metrics.p95_ms.toFixed(2)} ms`);
  }

  if (report.completion_metrics) {
    lines.push(`completed: ${report.completion_metrics.completed ? 'yes' : 'no'}`);
    lines.push(`timed_out: ${report.completion_metrics.timed_out ? 'yes' : 'no'}`);
    lines.push(`wall_time: ${report.completion_metrics.wall_time_ms.toFixed(2)} ms`);
  }

  if (report.classification_probe) {
    const probeSuffix = report.classification_probe.timed_out ? ' (timed out)' : '';
    lines.push(`Classification probe: ${report.classification_probe.elapsed_ms.toFixed(2)} ms${probeSuffix}`);
  }

  lines.push('');
  lines.push('Executed statements:');
  for (const statement of report.executed_statements) {
    lines.push(`${statement.seq}. ${statement.role}`);
    lines.push(`   elapsed_ms: ${statement.elapsed_ms !== undefined ? statement.elapsed_ms.toFixed(2) : '(n/a)'}`);
    lines.push(`   row_count: ${statement.row_count ?? '(n/a)'}`);
    if (statement.resolved_sql_preview) {
      lines.push(`   resolved_sql_preview: ${truncateSingleLine(statement.resolved_sql_preview, 120)}`);
    }
    lines.push(`   sql: ${truncateSingleLine(statement.sql, 120)}`);
    if (statement.sql_file) {
      lines.push(`   sql_file: ${statement.sql_file}`);
    }
    if (statement.resolved_sql_preview_file) {
      lines.push(`   resolved_sql_preview_file: ${statement.resolved_sql_preview_file}`);
    }
  }

  lines.push('');
  lines.push('Pipeline analysis:');
  lines.push(`  should_consider_pipeline: ${report.pipeline_analysis.should_consider_pipeline ? 'yes' : 'no'}`);
  if (report.pipeline_analysis.candidate_ctes.length === 0) {
    lines.push('  candidate_ctes: (none)');
  } else {
    for (const candidate of report.pipeline_analysis.candidate_ctes) {
      lines.push(`  - ${candidate.name}: downstream references=${candidate.downstream_references}`);
    }
  }
  lines.push(`  scalar_filter_candidates: ${report.pipeline_analysis.scalar_filter_candidates.length > 0 ? report.pipeline_analysis.scalar_filter_candidates.join(', ') : '(none)'}`);

  if (report.plan_observations.length > 0) {
    lines.push('');
    lines.push('Plan observations:');
    for (const observation of report.plan_observations) {
      lines.push(`- ${observation}`);
    }
  }

  if (report.recommended_actions.length > 0) {
    lines.push('');
    lines.push('Recommended actions:');
    for (const action of report.recommended_actions) {
      lines.push(`- [${action.priority}] ${action.action}: ${action.rationale}`);
    }
  }

  if (report.evidence_dir) {
    lines.push('');
    lines.push(`Evidence: ${report.evidence_dir}`);
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Render the diff summary in either text or JSON.
 */
export function formatPerfDiffReport(report: PerfDiffReport, format: PerfBenchmarkFormat): string {
  if (format === 'json') {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  const lines = [
    `Baseline mode: ${report.baseline_mode}`,
    `Candidate mode: ${report.candidate_mode}`,
    `Primary metric: ${report.primary_metric.name}`,
    `Baseline: ${report.primary_metric.baseline.toFixed(2)}`,
    `Candidate: ${report.primary_metric.candidate.toFixed(2)}`,
    `Improvement: ${report.primary_metric.improvement_percent.toFixed(2)}%`,
    `Statements delta: ${report.statements_delta}`,
  ];

  if (report.plan_deltas.some((delta) => delta.changed)) {
    lines.push('');
    lines.push('Plan deltas:');
    for (const delta of report.plan_deltas.filter((entry) => entry.changed)) {
      lines.push(`- ${delta.statement_id}: ${delta.baseline_plan} -> ${delta.candidate_plan}`);
    }
  }

  if (report.notes.length > 0) {
    lines.push('');
    lines.push('Notes:');
    for (const note of report.notes) {
      lines.push(`- ${note}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Surface pipeline candidacy from static SQL structure so agents can consider non-rewrite tuning paths.
 */
export function buildPerfPipelineAnalysis(sqlFile: string): PerfPipelineAnalysis {
  const structure = buildQueryStructureReport(sqlFile, 'ztd perf run');
  const referenceCounts = new Map<string, number>(structure.ctes.map((cte) => [cte.name, 0]));
  for (const cte of structure.ctes) {
    for (const dependency of cte.depends_on) {
      referenceCounts.set(dependency, (referenceCounts.get(dependency) ?? 0) + 1);
    }
  }
  for (const root of normalizeFinalQueryRoots(structure.final_query)) {
    referenceCounts.set(root, (referenceCounts.get(root) ?? 0) + 1);
  }

  const scalarFilterCandidates = findScalarFilterCandidates(sqlFile);

  const candidateCtes = structure.ctes
    .map((cte) => {
      const downstreamReferences = referenceCounts.get(cte.name) ?? 0;
      const reasons: string[] = [];
      if (downstreamReferences >= 2) {
        reasons.push('referenced by multiple downstream consumers');
      }
      if (!cte.unused && cte.depends_on.length >= 2) {
        reasons.push('merges multiple upstream dependencies');
      }
      return {
        name: cte.name,
        downstream_references: downstreamReferences,
        reasons
      };
    })
    .filter((candidate) => candidate.reasons.length > 0);

  const notes = [
    'Pipeline candidacy is heuristic in this MVP and does not yet benchmark SqlSpec runtime materialization directly.'
  ];
  if (scalarFilterCandidates.length > 0) {
    notes.push(`Optimizer-sensitive scalar predicates detected on columns: ${scalarFilterCandidates.join(', ')}`);
  }
  if (structure.unused_ctes.length > 0) {
    notes.push(`Unused CTEs detected: ${structure.unused_ctes.join(', ')}`);
  }

  return {
    query_type: structure.query_type,
    cte_count: structure.cte_count,
    should_consider_pipeline: candidateCtes.length > 0 || scalarFilterCandidates.length > 0,
    candidate_ctes: candidateCtes,
    scalar_filter_candidates: scalarFilterCandidates,
    notes
  };
}

/**
 * Load a saved benchmark report from summary.json.
 */
function buildPerfRecommendedActions(
  selectedMode: PerfSelectedBenchmarkMode,
  completed: boolean,
  pipelineAnalysis: PerfPipelineAnalysis,
  planFacts: PerfPlanFacts
): PerfRecommendedAction[] {
  const actions: PerfRecommendedAction[] = [];

  if (selectedMode === 'completion' && !completed) {
    actions.push({
      action: 'stabilize-completion-run',
      priority: 'high',
      rationale: 'The benchmark timed out in completion mode, so the next loop should focus on finishing the query before comparing latency percentiles.'
    });
  }
  if (pipelineAnalysis.candidate_ctes.length > 0) {
    actions.push({
      action: 'consider-pipeline-materialization',
      priority: 'medium',
      rationale: `Pipeline candidates detected: ${pipelineAnalysis.candidate_ctes.map((candidate) => candidate.name).join(', ')}.`
    });
  }
  if (pipelineAnalysis.scalar_filter_candidates.length > 0) {
    actions.push({
      action: 'consider-scalar-filter-binding',
      priority: 'medium',
      rationale: `Scalar filter candidates detected: ${pipelineAnalysis.scalar_filter_candidates.join(', ')}.`
    });
  }
  if (planFacts.hasSequentialScan) {
    actions.push({
      action: 'review-index-coverage',
      priority: 'medium',
      rationale: 'The captured plan includes a sequential scan, so index coverage is a likely tuning branch.'
    });
  }
  if (planFacts.hasJoin) {
    actions.push({
      action: 'inspect-join-strategy',
      priority: 'medium',
      rationale: 'The captured plan includes a join operator, so rewriting join shape or supporting it with indexes may help.'
    });
  }

  return uniqueRecommendedActions(actions);
}

function uniqueRecommendedActions(actions: PerfRecommendedAction[]): PerfRecommendedAction[] {
  const deduped = new Map<PerfRecommendedActionName, PerfRecommendedAction>();
  for (const action of actions) {
    deduped.set(action.action, action);
  }
  return Array.from(deduped.values());
}

function buildPerfPlanFacts(planJson: unknown): PerfPlanFacts {
  const observations: string[] = [];
  const statementSummaryParts: string[] = [];
  let hasSequentialScan = false;
  let hasJoin = false;

  walkPlanNodes(planJson, (node) => {
    const nodeType = normalizeString(node['Node Type']);
    const relationName = normalizeString(node['Relation Name']);
    const joinType = normalizeString(node['Join Type']);
    const cteName = normalizeString(node['CTE Name']);
    const filter = normalizeString(node.Filter ?? node['Index Cond']);

    if (!nodeType) {
      return;
    }

    statementSummaryParts.push(joinType ? `${joinType} ${nodeType}` : nodeType);

    if (nodeType === 'Seq Scan' && relationName) {
      hasSequentialScan = true;
      observations.push(
        filter
          ? `Seq Scan on ${relationName} with filter ${truncateSingleLine(filter, 90)}`
          : `Seq Scan on ${relationName}`
      );
    }
    if (nodeType === 'Nested Loop' || nodeType.includes('Join') || Boolean(joinType)) {
      hasJoin = true;
    }
    if (joinType) {
      observations.push(`${joinType} ${nodeType} present in the captured plan`);
    }
    if (nodeType === 'CTE Scan' && cteName) {
      observations.push(`CTE Scan reads ${cteName}`);
    }
  });

  return {
    observations: Array.from(new Set(observations)),
    statement_summary: Array.from(new Set(statementSummaryParts)).join(' -> ') || '(no plan captured)',
    hasSequentialScan,
    hasJoin
  };
}

function buildPerfPlanDeltas(baseline: PerfBenchmarkReport, candidate: PerfBenchmarkReport): PerfPlanDelta[] {
  const maxStatements = Math.max(baseline.executed_statements.length, candidate.executed_statements.length);
  const deltas: PerfPlanDelta[] = [];

  for (let index = 0; index < maxStatements; index += 1) {
    const baselineStatement = baseline.executed_statements[index];
    const candidateStatement = candidate.executed_statements[index];
    const statementId = formatPlanDeltaStatementId(candidateStatement ?? baselineStatement, index);
    const baselinePlan = summarizeStatementPlan(baselineStatement, baseline.plan_observations, index === 0);
    const candidatePlan = summarizeStatementPlan(candidateStatement, candidate.plan_observations, index === 0);
    deltas.push({
      statement_id: statementId,
      baseline_plan: baselinePlan,
      candidate_plan: candidatePlan,
      changed: baselinePlan !== candidatePlan
    });
  }

  return deltas;
}

function formatPlanDeltaStatementId(statement: PerfStatementReport | undefined, index: number): string {
  if (!statement) {
    return `statement-${index + 1}`;
  }
  return `${statement.seq}:${statement.role}`;
}

function summarizeStatementPlan(
  statement: PerfStatementReport | undefined,
  planObservations: string[],
  includeObservations: boolean
): string {
  if (!statement) {
    return '(missing statement)';
  }

  const parts: string[] = [];
  const summary = statement.plan_summary;
  if (summary?.join_type && summary.node_type) {
    parts.push(`${summary.join_type} ${summary.node_type}`);
  } else if (summary?.node_type) {
    parts.push(summary.node_type);
  }
  if (includeObservations && planObservations.length > 0) {
    parts.push(planObservations.join(' | '));
  }
  return parts.join(' :: ') || '(no plan captured)';
}

function walkPlanNodes(planJson: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (!Array.isArray(planJson)) {
    return;
  }
  for (const entry of planJson) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const plan = (entry as Record<string, unknown>).Plan;
    if (typeof plan === 'object' && plan !== null) {
      walkSinglePlanNode(plan as Record<string, unknown>, visit);
    }
  }
}

function walkSinglePlanNode(node: Record<string, unknown>, visit: (node: Record<string, unknown>) => void): void {
  visit(node);
  const plans = node.Plans;
  if (!Array.isArray(plans)) {
    return;
  }
  for (const child of plans) {
    if (typeof child === 'object' && child !== null) {
      walkSinglePlanNode(child as Record<string, unknown>, visit);
    }
  }
}

function renderResolvedSqlPreview(
  sql: string,
  bindings: unknown[] | Record<string, unknown> | undefined
): string | undefined {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return undefined;
  }

  return sql.replace(/\$(\d+)/g, (token, rawIndex) => {
    const binding = bindings[Number(rawIndex) - 1];
    return binding === undefined ? token : renderSqlLiteral(binding);
  });
}

function renderSqlLiteral(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}
export function loadPerfBenchmarkReport(evidenceDir: string): PerfBenchmarkReport {
  const summaryFile = path.join(path.resolve(evidenceDir), 'summary.json');
  const parsed = JSON.parse(readFileSync(summaryFile, 'utf8')) as unknown;
  return validatePerfBenchmarkReport(summaryFile, parsed);
}

export const PERF_BENCHMARK_DEFAULTS = {
  repeat: DEFAULT_REPEAT,
  warmup: DEFAULT_WARMUP,
  classifyThresholdSeconds: DEFAULT_CLASSIFY_THRESHOLD_SECONDS,
  timeoutMinutes: DEFAULT_TIMEOUT_MINUTES
} as const;

function prepareBenchmarkQuery(rootDir: string, queryFile: string, paramsFile?: string): PreparedBenchmarkQuery {
  const absolutePath = path.resolve(rootDir, queryFile);
  const sourceSql = readFileSync(absolutePath, 'utf8');
  const structure = buildQueryStructureReport(absolutePath, 'ztd perf run');
  if (structure.query_type !== 'SELECT') {
    throw new Error('ztd perf run currently supports SELECT queries only.');
  }

  const scan = scanModelGenSql(sourceSql);
  const rawBindings = paramsFile ? loadPerfBindings(rootDir, paramsFile) : undefined;

  if (scan.mode === 'named') {
    if (!rawBindings || typeof rawBindings !== 'object' || Array.isArray(rawBindings)) {
      throw new Error('Named SQL placeholders require an object in --params.');
    }
    const bound = bindModelGenNamedSql(sourceSql);
    const orderedValues = bound.orderedParamNames.map((name) => {
      if (!(name in rawBindings)) {
        throw new Error(`Missing named benchmark param: ${name}`);
      }
      return (rawBindings as Record<string, unknown>)[name];
    });
    return {
      absolutePath,
      sourceSql,
      boundSql: bound.boundSql,
      queryType: 'SELECT',
      paramsShape: scan.mode,
      orderedParamNames: bound.orderedParamNames,
      bindings: orderedValues
    };
  }

  if (scan.mode === 'positional') {
    if (!Array.isArray(rawBindings)) {
      throw new Error('Positional SQL placeholders require an array in --params.');
    }

    const orderedParamNames = scan.positionalTokens.map((token) => token.token);
    const highestRequiredIndex = orderedParamNames.reduce((max, token) => {
      const parsed = Number(token.slice(1));
      return Number.isInteger(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    if (rawBindings.length < highestRequiredIndex) {
      throw new Error(`Positional SQL placeholders require at least ${highestRequiredIndex} parameters for $${highestRequiredIndex}.`);
    }

    return {
      absolutePath,
      sourceSql,
      boundSql: sourceSql,
      queryType: 'SELECT',
      paramsShape: scan.mode,
      orderedParamNames,
      bindings: rawBindings
    };
  }

  if (rawBindings !== undefined) {
    throw new Error('This SQL file has no placeholders, so --params is not needed.');
  }

  return {
    absolutePath,
    sourceSql,
    boundSql: sourceSql,
    queryType: 'SELECT',
    paramsShape: 'none',
    orderedParamNames: [],
    bindings: undefined
  };
}

function loadPerfBindings(rootDir: string, paramsFile: string): unknown {
  const absolutePath = path.resolve(rootDir, paramsFile);
  const rawContents = readFileSync(absolutePath, 'utf8');

  try {
    if (path.extname(absolutePath).toLowerCase() === '.json') {
      return JSON.parse(rawContents);
    }

    const parsed = parseYaml(rawContents);
    if (isPerfParamsEnvelope(parsed)) {
      return parsed.params;
    }
    return parsed ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse perf params file ${absolutePath}: ${message}`);
  }
}

function isPerfParamsEnvelope(value: unknown): value is { params: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'params' in value;
}

async function fetchPerfDatabaseVersion(rootDir: string): Promise<string | undefined> {
  const pg = await ensurePgModule();
  const sandboxConfig = loadPerfSandboxConfig(rootDir);
  const resolvedConnection = await ensurePerfConnection(rootDir, sandboxConfig);
  const client = new pg.Client({
    connectionString: resolvedConnection.connectionUrl,
    connectionTimeoutMillis: 3000
  });

  try {
    await client.connect();
    const result = await client.query<{ server_version?: string }>('SHOW server_version');
    return result.rows?.[0]?.server_version;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function classifyPerfBenchmarkMode(
  rootDir: string,
  prepared: PreparedBenchmarkQuery,
  classifyThresholdMs: number
): Promise<PerfSelectionResult> {
  const probe = await executeDirectBenchmarkOnce(rootDir, prepared, classifyThresholdMs);
  if (probe.timedOut || probe.elapsedMs >= classifyThresholdMs) {
    return {
      selectedMode: 'completion',
      reason: `classification probe exceeded ${classifyThresholdMs} ms`,
      probe
    };
  }

  return {
    selectedMode: 'latency',
    reason: `classification probe completed within ${classifyThresholdMs} ms`,
    probe
  };
}

async function executeDirectBenchmarkOnce(
  rootDir: string,
  prepared: PreparedBenchmarkQuery,
  timeoutMs: number
): Promise<DirectExecutionResult> {
  const pg = await ensurePgModule();
  const sandboxConfig = loadPerfSandboxConfig(rootDir);
  const resolvedConnection = await ensurePerfConnection(rootDir, sandboxConfig);
  const client = new pg.Client({
    connectionString: resolvedConnection.connectionUrl,
    connectionTimeoutMillis: 3000
  });

  try {
    await client.connect();
    await client.query(`SET statement_timeout = ${Math.max(1, Math.trunc(timeoutMs))}`);

    // Measure only statement execution so connection setup noise does not pollute SQL tuning latency.
    const startedAt = nowMs();
    const result = await client.query(prepared.boundSql, prepared.bindings as unknown[] | undefined);
    return {
      elapsedMs: nowMs() - startedAt,
      rowCount: extractRowCount(result as { rowCount?: number; rows?: unknown[] }),
      timedOut: false
    };
  } catch (error) {
    if (isQueryTimeout(error)) {
      return {
        elapsedMs: timeoutMs,
        timedOut: true
      };
    }
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function captureDirectPlan(
  rootDir: string,
  prepared: PreparedBenchmarkQuery,
  timeoutMs: number,
  analyze: boolean
): Promise<unknown | null> {
  const pg = await ensurePgModule();
  const sandboxConfig = loadPerfSandboxConfig(rootDir);
  const resolvedConnection = await ensurePerfConnection(rootDir, sandboxConfig);
  const client = new pg.Client({
    connectionString: resolvedConnection.connectionUrl,
    connectionTimeoutMillis: 3000
  });

  const explainPrefix = analyze
    ? 'EXPLAIN (ANALYZE TRUE, BUFFERS TRUE, FORMAT JSON) '
    : 'EXPLAIN (FORMAT JSON) ';

  try {
    await client.connect();
    await client.query(`SET statement_timeout = ${Math.max(1, Math.trunc(timeoutMs))}`);
    const result = await client.query(`${explainPrefix}${prepared.boundSql}`, prepared.bindings as unknown[] | undefined);
    const firstRow = (result.rows?.[0] ?? {}) as Record<string, unknown>;
    return firstRow['QUERY PLAN'] ?? firstRow['query plan'] ?? null;
  } catch (error) {
    if (isQueryTimeout(error)) {
      return null;
    }
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

function buildLatencyMetrics(runs: number[], warmupRuns: number): PerfBenchmarkReport['latency_metrics'] {
  const sorted = [...runs].sort((left, right) => left - right);
  return {
    measured_runs: runs.length,
    warmup_runs: warmupRuns,
    min_ms: sorted[0] ?? 0,
    max_ms: sorted[sorted.length - 1] ?? 0,
    avg_ms: runs.reduce((sum, value) => sum + value, 0) / Math.max(runs.length, 1),
    median_ms: percentile(sorted, 0.5),
    p95_ms: percentile(sorted, 0.95)
  };
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

function summarizePlanJson(planJson: unknown): PerfPlanSummary | null {
  const topLevel = Array.isArray(planJson) ? planJson[0] : null;
  if (!topLevel || typeof topLevel !== 'object') {
    return null;
  }

  const record = topLevel as Record<string, unknown>;
  const plan = (record.Plan ?? null) as Record<string, unknown> | null;
  if (!plan) {
    return null;
  }

  return {
    node_type: normalizeString(plan['Node Type']),
    join_type: normalizeString(plan['Join Type']),
    total_cost: normalizeNumber(plan['Total Cost']),
    plan_rows: normalizeNumber(plan['Plan Rows']),
    actual_rows: normalizeNumber(plan['Actual Rows']),
    actual_total_time: normalizeNumber(plan['Actual Total Time'])
  };
}

function savePerfBenchmarkEvidence(
  rootDir: string,
  report: PerfBenchmarkReport,
  planJson: unknown
): { runId: string; evidenceDir: string; planFiles: string[]; sqlFiles: string[]; resolvedSqlPreviewFiles: string[] } {
  const evidenceRoot = path.join(rootDir, 'perf', 'evidence');
  mkdirSync(evidenceRoot, { recursive: true });
  const reserved = reservePerfEvidenceDir(evidenceRoot, report.label);
  const plansDir = path.join(reserved.evidenceDir, 'plans');
  const sqlDir = path.join(reserved.evidenceDir, 'executed-sql');
  mkdirSync(plansDir, { recursive: true });
  mkdirSync(sqlDir, { recursive: true });

  copyFileSync(report.source_sql_file, path.join(reserved.evidenceDir, 'source.sql'));
  if (report.params_file && existsSync(report.params_file)) {
    copyFileSync(report.params_file, path.join(reserved.evidenceDir, path.basename(report.params_file)));
  }

  const planFiles: string[] = [];
  const sqlFiles: string[] = [];
  const resolvedSqlPreviewFiles: string[] = [];
  for (const statement of report.executed_statements) {
    const baseName = `${String(statement.seq).padStart(3, '0')}-${statement.role}`;
    const sqlFileName = `${baseName}.bound.sql`;
    const relativeSqlPath = path.join('executed-sql', sqlFileName).replace(/\\/g, '/');
    writeFileSync(path.join(sqlDir, sqlFileName), `${statement.sql.trimEnd()}\n`, 'utf8');
    sqlFiles.push(relativeSqlPath);

    if (statement.resolved_sql_preview) {
      const resolvedFileName = `${baseName}.resolved-preview.sql`;
      const relativeResolvedPath = path.join('executed-sql', resolvedFileName).replace(/\\/g, '/');
      writeFileSync(path.join(sqlDir, resolvedFileName), `${statement.resolved_sql_preview.trimEnd()}\n`, 'utf8');
      resolvedSqlPreviewFiles.push(relativeResolvedPath);
    } else {
      resolvedSqlPreviewFiles.push('');
    }

    if (planJson !== null) {
      const planFileName = `${baseName}.plan.json`;
      const relativePlanPath = path.join('plans', planFileName).replace(/\\/g, '/');
      writeFileSync(path.join(plansDir, planFileName), `${JSON.stringify(planJson, null, 2)}\n`, 'utf8');
      planFiles.push(relativePlanPath);
    } else {
      planFiles.push('');
    }
  }

  const summary: PerfBenchmarkReport = {
    ...report,
    run_id: reserved.runId,
    evidence_dir: reserved.evidenceDir,
    saved: true,
    executed_statements: report.executed_statements.map((statement, index) => ({
      ...statement,
      sql_file: sqlFiles[index] || undefined,
      resolved_sql_preview_file: resolvedSqlPreviewFiles[index] || undefined,
      plan_file: planFiles[index] || undefined
    }))
  };
  writeFileSync(path.join(reserved.evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(path.join(reserved.evidenceDir, 'executed-statements.json'), `${JSON.stringify(summary.executed_statements, null, 2)}\n`, 'utf8');

  return {
    runId: reserved.runId,
    evidenceDir: reserved.evidenceDir,
    planFiles,
    sqlFiles,
    resolvedSqlPreviewFiles
  };
}

function reservePerfEvidenceDir(evidenceRoot: string, label: string | undefined): { runId: string; evidenceDir: string } {
  const suffix = label ? `_${sanitizeLabel(label)}` : '';
  let nextRun = readHighestPerfRunIndex(evidenceRoot) + 1;

  // Reserve the run directory atomically so concurrent perf runs cannot collide.
  for (let attempts = 0; attempts < 1024; attempts += 1) {
    const runId = `run_${String(nextRun).padStart(3, '0')}${suffix}`;
    const evidenceDir = path.join(evidenceRoot, runId);
    try {
      mkdirSync(evidenceDir);
      return { runId, evidenceDir };
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        nextRun += 1;
        continue;
      }
      throw error;
    }
  }

  throw new Error('Unable to allocate a perf evidence directory after repeated collisions.');
}

function readHighestPerfRunIndex(evidenceRoot: string): number {
  const existing = readdirSync(evidenceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  return existing.reduce((max, name) => {
    const match = /^run_(\d+)/.exec(name);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
}

function sanitizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function isAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'EEXIST';
}

function toPerfClassificationProbe(result: DirectExecutionResult): PerfClassificationProbe {
  return {
    elapsed_ms: result.elapsedMs,
    timed_out: result.timedOut,
    row_count: result.rowCount
  };
}

function validatePerfBenchmarkReport(summaryFile: string, value: unknown): PerfBenchmarkReport {
  if (!isPerfBenchmarkReport(value)) {
    throw new Error(`Invalid perf benchmark summary: ${summaryFile}`);
  }
  return value;
}

function isPerfBenchmarkReport(value: unknown): value is PerfBenchmarkReport {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const report = value as Record<string, unknown>;
  if (report.schema_version !== 1 || report.command !== 'perf run') {
    return false;
  }
  if (report.query_type !== 'SELECT' || report.strategy !== 'direct') {
    return false;
  }
  if (!isPerfSelectedMode(report.selected_mode) || !isPerfRequestedMode(report.requested_mode)) {
    return false;
  }
  if (!isStringArray(report.ordered_param_names) || !isPerfStatementReportArray(report.executed_statements)) {
    return false;
  }
  if (!isStringArray(report.plan_observations) || !isPerfRecommendedActionArray(report.recommended_actions)) {
    return false;
  }
  if (!isPerfPipelineAnalysis(report.pipeline_analysis) || !isOptionalPerfClassificationProbe(report.classification_probe)) {
    return false;
  }
  return typeof report.query_file === 'string'
    && typeof report.source_sql_file === 'string'
    && typeof report.source_sql === 'string'
    && typeof report.bound_sql === 'string'
    && typeof report.selection_reason === 'string'
    && typeof report.classify_threshold_ms === 'number'
    && typeof report.timeout_ms === 'number'
    && typeof report.dry_run === 'boolean'
    && typeof report.saved === 'boolean'
    && isOptionalString(report.params_file)
    && isOptionalString(report.run_id)
    && isOptionalString(report.label)
    && isOptionalString(report.evidence_dir)
    && isOptionalString(report.database_version)
    && isOptionalNumber(report.total_elapsed_ms)
    && isOptionalPerfPlanSummary(report.plan_summary)
    && isOptionalLatencyMetrics(report.latency_metrics)
    && isOptionalCompletionMetrics(report.completion_metrics);
}

function isPerfSelectedMode(value: unknown): value is PerfSelectedBenchmarkMode {
  return value === 'latency' || value === 'completion';
}

function isPerfRequestedMode(value: unknown): value is PerfBenchmarkMode {
  return value === 'auto' || value === 'latency' || value === 'completion';
}

function isPerfPipelineAnalysis(value: unknown): value is PerfPipelineAnalysis {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const analysis = value as Record<string, unknown>;
  return typeof analysis.query_type === 'string'
    && typeof analysis.cte_count === 'number'
    && typeof analysis.should_consider_pipeline === 'boolean'
    && Array.isArray(analysis.candidate_ctes)
    && Array.isArray(analysis.scalar_filter_candidates)
    && Array.isArray(analysis.notes);
}

function isPerfStatementReportArray(value: unknown): value is PerfStatementReport[] {
  return Array.isArray(value) && value.every((statement) => isPerfStatementReport(statement));
}

function isPerfStatementReport(value: unknown): value is PerfStatementReport {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const statement = value as Record<string, unknown>;
  return typeof statement.seq === 'number'
    && statement.role === 'final-query'
    && typeof statement.sql === 'string'
    && isOptionalBindings(statement.bindings)
    && isOptionalString(statement.resolved_sql_preview)
    && isOptionalNumber(statement.row_count)
    && isOptionalNumber(statement.elapsed_ms)
    && isOptionalBoolean(statement.timed_out)
    && isOptionalPerfPlanSummary(statement.plan_summary)
    && isOptionalString(statement.sql_file)
    && isOptionalString(statement.resolved_sql_preview_file)
    && isOptionalString(statement.plan_file);
}

function isPerfRecommendedActionArray(value: unknown): value is PerfRecommendedAction[] {
  return Array.isArray(value) && value.every((action) => isPerfRecommendedAction(action));
}

function isPerfRecommendedAction(value: unknown): value is PerfRecommendedAction {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const action = value as Record<string, unknown>;
  return typeof action.action === 'string'
    && (action.priority === 'high' || action.priority === 'medium')
    && typeof action.rationale === 'string';
}

function isOptionalPerfClassificationProbe(value: unknown): value is PerfClassificationProbe | undefined {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const probe = value as Record<string, unknown>;
  return typeof probe.elapsed_ms === 'number'
    && typeof probe.timed_out === 'boolean'
    && isOptionalNumber(probe.row_count)
    && isOptionalBoolean(probe.reused_as_warmup)
    && isOptionalBoolean(probe.reused_as_measured_run);
}

function isOptionalPerfPlanSummary(value: unknown): value is PerfPlanSummary | null | undefined {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value !== 'object') {
    return false;
  }
  const summary = value as Record<string, unknown>;
  return isOptionalString(summary.node_type)
    && isOptionalString(summary.join_type)
    && isOptionalNumber(summary.total_cost)
    && isOptionalNumber(summary.plan_rows)
    && isOptionalNumber(summary.actual_rows)
    && isOptionalNumber(summary.actual_total_time);
}

function isOptionalLatencyMetrics(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const metrics = value as Record<string, unknown>;
  return typeof metrics.measured_runs === 'number'
    && typeof metrics.warmup_runs === 'number'
    && typeof metrics.min_ms === 'number'
    && typeof metrics.max_ms === 'number'
    && typeof metrics.avg_ms === 'number'
    && typeof metrics.median_ms === 'number'
    && typeof metrics.p95_ms === 'number';
}

function isOptionalCompletionMetrics(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const metrics = value as Record<string, unknown>;
  return typeof metrics.completed === 'boolean'
    && typeof metrics.timed_out === 'boolean'
    && typeof metrics.wall_time_ms === 'number';
}

function isOptionalBindings(value: unknown): boolean {
  return value === undefined || Array.isArray(value) || (typeof value === 'object' && value !== null);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === 'number';
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}

function normalizeFinalQueryRoots(finalQuery: string | string[] | null | undefined): string[] {
  if (Array.isArray(finalQuery)) {
    return finalQuery.map((value) => value.trim()).filter(Boolean);
  }
  if (typeof finalQuery === 'string') {
    return finalQuery.split(',').map((value) => value.trim()).filter(Boolean);
  }
  return [];
}

function calculateImprovementPercent(baseline: number, candidate: number): number {
  if (baseline === 0) {
    return 0;
  }
  return ((baseline - candidate) / baseline) * 100;
}

function extractRowCount(result: { rowCount?: number; rows?: unknown[] }): number | undefined {
  if (typeof result.rowCount === 'number') {
    return result.rowCount;
  }
  return Array.isArray(result.rows) ? result.rows.length : undefined;
}

function isQueryTimeout(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '57014';
}

function nowMs(): number {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function truncateSingleLine(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 3)}...`;
}









