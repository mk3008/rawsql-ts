import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ensurePgModule } from '../utils/optionalDependencies';
import { bindModelGenNamedSql } from '../utils/modelGenBinder';
import { scanModelGenSql, type PlaceholderMode } from '../utils/modelGenScanner';
import { buildQueryStructureReport } from '../query/structure';
import { loadPerfSandboxConfig, ensurePerfConnection, type PerfSeedConfig, loadPerfSeedConfig } from './sandbox';

export type PerfBenchmarkMode = 'auto' | 'latency' | 'completion';
export type PerfSelectedBenchmarkMode = 'latency' | 'completion';
export type PerfBenchmarkFormat = 'text' | 'json';
export type PerfExecutionStrategy = 'direct';

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
  row_count?: number;
  elapsed_ms?: number;
  timed_out?: boolean;
  plan_summary?: PerfPlanSummary | null;
  plan_file?: string;
}

export interface PerfPlanSummary {
  node_type?: string;
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
  notes: string[];
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
  dry_run: boolean;
  saved: boolean;
  evidence_dir?: string;
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

const DEFAULT_REPEAT = 10;
const DEFAULT_WARMUP = 3;
const DEFAULT_CLASSIFY_THRESHOLD_SECONDS = 60;
const DEFAULT_TIMEOUT_MINUTES = 5;

/**
 * Execute or plan a direct SQL benchmark against the perf sandbox.
 */
export async function runPerfBenchmark(options: PerfRunOptions): Promise<PerfBenchmarkReport> {
  const prepared = prepareBenchmarkQuery(options.rootDir, options.queryFile, options.paramsFile);
  const pipelineAnalysis = buildPerfPipelineAnalysis(prepared.absolutePath);
  const classifyThresholdMs = options.classifyThresholdSeconds * 1000;
  const timeoutMs = options.timeoutMinutes * 60 * 1000;
  const seedConfig = loadPerfSeedConfig(options.rootDir);

  const selection = options.dryRun
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
      dry_run: true,
      saved: false,
      executed_statements: [
        {
          seq: 1,
          role: 'final-query',
          sql: prepared.boundSql,
          bindings: prepared.bindings
        }
      ],
      pipeline_analysis: pipelineAnalysis,
      seed: { seed: seedConfig.seed }
    };
  }

  const latencyRuns: number[] = [];
  let representativeExecution: DirectExecutionResult | undefined;
  let representativePlan: unknown = null;

  if (selection.selectedMode === 'latency') {
    for (let index = 0; index < options.warmup; index += 1) {
      const warmupExecution = await executeDirectBenchmarkOnce(options.rootDir, prepared, timeoutMs);
      if (warmupExecution.timedOut) {
        throw new Error('Latency benchmark timed out during warmup. Re-run with --mode completion or a larger timeout.');
      }
    }

    for (let index = 0; index < options.repeat; index += 1) {
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
    representativeExecution = await executeDirectBenchmarkOnce(options.rootDir, prepared, timeoutMs);
    representativePlan = await captureDirectPlan(options.rootDir, prepared, timeoutMs, !representativeExecution.timedOut);
  }

  const executedStatements: PerfStatementReport[] = [
    {
      seq: 1,
      role: 'final-query',
      sql: prepared.boundSql,
      bindings: prepared.bindings,
      row_count: representativeExecution?.rowCount,
      elapsed_ms: representativeExecution?.elapsedMs,
      timed_out: representativeExecution?.timedOut,
      plan_summary: summarizePlanJson(representativePlan)
    }
  ];

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
    dry_run: false,
    saved: false,
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

  lines.push('');
  lines.push('Executed statements:');
  for (const statement of report.executed_statements) {
    lines.push(`${statement.seq}. ${statement.role}`);
    lines.push(`   elapsed_ms: ${statement.elapsed_ms !== undefined ? statement.elapsed_ms.toFixed(2) : '(n/a)'}`);
    lines.push(`   row_count: ${statement.row_count ?? '(n/a)'}`);
    lines.push(`   sql: ${truncateSingleLine(statement.sql, 120)}`);
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
  for (const root of (structure.final_query ?? '').split(',').map((value) => value.trim()).filter(Boolean)) {
    referenceCounts.set(root, (referenceCounts.get(root) ?? 0) + 1);
  }

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
  if (structure.unused_ctes.length > 0) {
    notes.push(`Unused CTEs detected: ${structure.unused_ctes.join(', ')}`);
  }

  return {
    query_type: structure.query_type,
    cte_count: structure.cte_count,
    should_consider_pipeline: candidateCtes.length > 0,
    candidate_ctes: candidateCtes,
    notes
  };
}

/**
 * Load a saved benchmark report from summary.json.
 */
export function loadPerfBenchmarkReport(evidenceDir: string): PerfBenchmarkReport {
  const summaryFile = path.join(path.resolve(evidenceDir), 'summary.json');
  return JSON.parse(readFileSync(summaryFile, 'utf8')) as PerfBenchmarkReport;
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
      throw new Error('Named SQL placeholders require a JSON object in --params.');
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
      throw new Error('Positional SQL placeholders require a JSON array in --params.');
    }
    return {
      absolutePath,
      sourceSql,
      boundSql: sourceSql,
      queryType: 'SELECT',
      paramsShape: scan.mode,
      orderedParamNames: scan.positionalTokens.map((token) => token.token),
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
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

async function classifyPerfBenchmarkMode(
  rootDir: string,
  prepared: PreparedBenchmarkQuery,
  classifyThresholdMs: number
): Promise<{ selectedMode: PerfSelectedBenchmarkMode; reason: string }> {
  const probe = await executeDirectBenchmarkOnce(rootDir, prepared, classifyThresholdMs);
  if (probe.timedOut || probe.elapsedMs >= classifyThresholdMs) {
    return {
      selectedMode: 'completion',
      reason: `classification probe exceeded ${classifyThresholdMs} ms`
    };
  }

  return {
    selectedMode: 'latency',
    reason: `classification probe completed within ${classifyThresholdMs} ms`
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

  const startedAt = nowMs();
  try {
    await client.connect();
    await client.query(`SET statement_timeout = ${Math.max(1, Math.trunc(timeoutMs))}`);
    const result = await client.query(prepared.boundSql, prepared.bindings as unknown[] | undefined);
    return {
      elapsedMs: nowMs() - startedAt,
      rowCount: extractRowCount(result as { rowCount?: number; rows?: unknown[] }),
      timedOut: false
    };
  } catch (error) {
    if (isQueryTimeout(error)) {
      return {
        elapsedMs: nowMs() - startedAt,
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
): { runId: string; evidenceDir: string; planFiles: string[] } {
  const evidenceRoot = path.join(rootDir, 'perf', 'evidence');
  mkdirSync(evidenceRoot, { recursive: true });
  const runId = allocatePerfRunId(evidenceRoot, report.label);
  const evidenceDir = path.join(evidenceRoot, runId);
  const plansDir = path.join(evidenceDir, 'plans');
  const sqlDir = path.join(evidenceDir, 'executed-sql');
  mkdirSync(evidenceDir, { recursive: true });
  mkdirSync(plansDir, { recursive: true });
  mkdirSync(sqlDir, { recursive: true });

  copyFileSync(report.source_sql_file, path.join(evidenceDir, 'source.sql'));
  if (report.params_file && existsSync(report.params_file)) {
    copyFileSync(report.params_file, path.join(evidenceDir, 'params.json'));
  }

  const planFiles: string[] = [];
  for (const statement of report.executed_statements) {
    const sqlFileName = `${String(statement.seq).padStart(3, '0')}-${statement.role}.sql`;
    writeFileSync(path.join(sqlDir, sqlFileName), `${statement.sql.trimEnd()}\n`, 'utf8');

    if (planJson !== null) {
      const planFileName = `${String(statement.seq).padStart(3, '0')}-${statement.role}.plan.json`;
      const relativePlanPath = path.join('plans', planFileName).replace(/\\/g, '/');
      writeFileSync(path.join(plansDir, planFileName), `${JSON.stringify(planJson, null, 2)}\n`, 'utf8');
      planFiles.push(relativePlanPath);
    } else {
      planFiles.push('');
    }
  }

  const summary: PerfBenchmarkReport = {
    ...report,
    run_id: runId,
    evidence_dir: evidenceDir,
    saved: true,
    executed_statements: report.executed_statements.map((statement, index) => ({
      ...statement,
      plan_file: planFiles[index] || undefined
    }))
  };
  writeFileSync(path.join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(path.join(evidenceDir, 'executed-statements.json'), `${JSON.stringify(summary.executed_statements, null, 2)}\n`, 'utf8');

  return {
    runId,
    evidenceDir,
    planFiles
  };
}

function allocatePerfRunId(evidenceRoot: string, label: string | undefined): string {
  const existing = readdirSync(evidenceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const maxRun = existing.reduce((max, name) => {
    const match = /^run_(\d+)/.exec(name);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const next = String(maxRun + 1).padStart(3, '0');
  const suffix = label ? `_${sanitizeLabel(label)}` : '';
  return `run_${next}${suffix}`;
}

function sanitizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
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

