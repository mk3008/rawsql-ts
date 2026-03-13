import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ensurePgModule } from '../utils/optionalDependencies';
import { bindModelGenNamedSql } from '../utils/modelGenBinder';
import { scanModelGenSql, type PlaceholderMode } from '../utils/modelGenScanner';
import { buildQueryStructureReport } from '../query/structure';
import { findScalarFilterCandidates } from '../query/scalarFilterAnalysis';
import { executeQueryPipeline, type QueryPipelineSession, type QueryPipelineSessionFactory } from '../query/execute';
import { buildQueryPipelinePlan, type QueryPipelineMetadata, type QueryPipelineStep } from '../query/planner';
import { ensurePerfConnection, inspectPerfDdlInventory, loadPerfSandboxConfig, loadPerfSeedConfig, type PerfDdlInventory, type PerfSeedConfig } from './sandbox';

export type PerfBenchmarkMode = 'auto' | 'latency' | 'completion';
export type PerfSelectedBenchmarkMode = 'latency' | 'completion';
export type PerfBenchmarkFormat = 'text' | 'json';
export type PerfExecutionStrategy = 'direct' | 'decomposed';
export type PerfStatementRole = 'materialize' | 'scalar-filter-bind' | 'final-query';
export type PerfRecommendedActionName =
  | 'consider-pipeline-materialization'
  | 'review-index-coverage'
  | 'inspect-join-strategy'
  | 'stabilize-completion-run'
  | 'capture-perf-evidence'
  | 'increase-perf-fixture-scale'
  | 'consider-scalar-filter-binding';

export interface PerfRunOptions {
  rootDir: string;
  queryFile: string;
  paramsFile?: string;
  strategy: PerfExecutionStrategy;
  material: string[];
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
  role: PerfStatementRole;
  target?: string;
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

export interface PerfStrategyMetadata {
  materialized_ctes: string[];
  scalar_filter_columns: string[];
  planned_steps: Array<{
    step: number;
    kind: QueryPipelineStep['kind'];
    target: string;
    depends_on: string[];
  }>;
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

export interface PerfStatementDelta {
  statement_id: string;
  role: PerfStatementRole;
  baseline_elapsed_ms?: number;
  candidate_elapsed_ms?: number;
  elapsed_delta_ms?: number;
  baseline_row_count?: number;
  candidate_row_count?: number;
  baseline_timed_out?: boolean;
  candidate_timed_out?: boolean;
}

interface PerfPlanFacts {
  observations: string[];
  statement_summary: string;
  hasCapturedPlan: boolean;
  hasSequentialScan: boolean;
  hasJoin: boolean;
}

export type PerfExpectedScale = 'tiny' | 'small' | 'medium' | 'large' | 'batch';
export type PerfReviewPolicy = 'none' | 'recommended' | 'strongly-recommended';
export type PerfEvidenceStatus = 'captured' | 'missing' | 'not-required';
export type PerfFixtureRowsStatus = 'sufficient' | 'undersized' | 'unknown';

export interface PerfQuerySpecGuidance {
  spec_id: string;
  spec_file: string;
  expected_scale?: PerfExpectedScale;
  expected_input_rows?: number;
  expected_output_rows?: number;
  review_policy: PerfReviewPolicy;
  evidence_status: PerfEvidenceStatus;
  fixture_rows_available?: number;
  fixture_rows_status: PerfFixtureRowsStatus;
}

export interface PerfDdlInventorySummary {
  ddl_files: number;
  ddl_statement_count: number;
  table_count: number;
  index_count: number;
  index_names: string[];
}

export type PerfTuningPrimaryPath = 'index' | 'pipeline' | 'capture-plan';

export interface PerfTuningBranchGuidance {
  recommended: boolean;
  rationale: string[];
  next_steps: string[];
}

export interface PerfTuningGuidance {
  primary_path: PerfTuningPrimaryPath;
  requires_captured_plan: boolean;
  index_branch: PerfTuningBranchGuidance;
  pipeline_branch: PerfTuningBranchGuidance;
}

export interface PerfTuningSummary {
  headline: string;
  evidence: string[];
  next_step: string;
}

interface DiscoveredPerfQuerySpecMetadata {
  specId: string;
  specFile: string;
  expectedScale?: PerfExpectedScale;
  expectedInputRows?: number;
  expectedOutputRows?: number;
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
  strategy_metadata?: PerfStrategyMetadata;
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
  spec_guidance?: PerfQuerySpecGuidance;
  ddl_inventory?: PerfDdlInventorySummary;
  tuning_guidance?: PerfTuningGuidance;
  tuning_summary?: PerfTuningSummary;
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
  strategy_changed: boolean;
  statements_delta: number;
  statement_deltas: PerfStatementDelta[];
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
  runtimeBindings: unknown[] | Record<string, unknown> | undefined;
}

interface StatementExecutionTrace {
  role: PerfStatementRole;
  target: string;
  sql: string;
  bindings: unknown[] | Record<string, unknown> | undefined;
  resolvedSqlPreview?: string;
  elapsedMs: number;
  rowCount?: number;
  timedOut: boolean;
  planJson?: unknown | null;
}

interface BenchmarkExecutionResult {
  elapsedMs: number;
  rowCount?: number;
  timedOut: boolean;
  statements: StatementExecutionTrace[];
  finalPlanJson?: unknown | null;
  strategyMetadata?: PerfStrategyMetadata;
}

interface PerfSelectionResult {
  selectedMode: PerfSelectedBenchmarkMode;
  reason: string;
  probe?: BenchmarkExecutionResult;
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

const PERF_REVIEW_POLICY_BY_SCALE: Record<PerfExpectedScale, PerfReviewPolicy> = {
  tiny: 'none',
  small: 'none',
  medium: 'recommended',
  large: 'strongly-recommended',
  batch: 'strongly-recommended'
};

const PERF_REVIEW_POLICY_SEVERITY: Record<PerfReviewPolicy, number> = {
  none: 0,
  recommended: 1,
  'strongly-recommended': 2
};

const PERF_SPEC_DISCOVERY_ROOTS = [
  path.join('src', 'catalog', 'specs'),
  path.join('src', 'specs'),
  'specs'
];

function buildPerfQuerySpecGuidance(
  rootDir: string,
  queryFile: string,
  seedConfig: PerfSeedConfig,
  saveEvidence: boolean,
  dryRun: boolean
): PerfQuerySpecGuidance | undefined {
  const discovered = discoverPerfQuerySpecMetadata(rootDir, queryFile);
  if (!discovered) {
    return undefined;
  }

  const reviewPolicy = toPerfReviewPolicy(discovered.expectedScale, discovered.expectedInputRows);
  const relationsUsed = buildQueryStructureReport(queryFile, 'ztd perf run').referenced_tables;
  const fixtureRowsAvailable = countPerfSeedRows(seedConfig, relationsUsed);
  const fixtureRowsStatus = toPerfFixtureRowsStatus(fixtureRowsAvailable, discovered.expectedInputRows);
  const evidenceStatus = saveEvidence && !dryRun
    ? 'captured'
    : reviewPolicy === 'strongly-recommended' ? 'missing' : 'not-required';

  return {
    spec_id: discovered.specId,
    spec_file: discovered.specFile,
    expected_scale: discovered.expectedScale,
    expected_input_rows: discovered.expectedInputRows,
    expected_output_rows: discovered.expectedOutputRows,
    review_policy: reviewPolicy,
    evidence_status: evidenceStatus,
    fixture_rows_available: fixtureRowsAvailable,
    fixture_rows_status: fixtureRowsStatus
  };
}

function toPerfReviewPolicy(
  expectedScale: PerfExpectedScale | undefined,
  expectedInputRows: number | undefined
): PerfReviewPolicy {
  const scalePolicy = expectedScale ? PERF_REVIEW_POLICY_BY_SCALE[expectedScale] : 'none';
  const rowsPolicy = expectedInputRows === undefined
    ? 'none'
    : expectedInputRows >= 100_000
      ? 'strongly-recommended'
      : expectedInputRows >= 10_000
        ? 'recommended'
        : 'none';

  return PERF_REVIEW_POLICY_SEVERITY[scalePolicy] >= PERF_REVIEW_POLICY_SEVERITY[rowsPolicy]
    ? scalePolicy
    : rowsPolicy;
}

function toPerfFixtureRowsStatus(
  fixtureRowsAvailable: number | undefined,
  expectedInputRows: number | undefined
): PerfFixtureRowsStatus {
  if (expectedInputRows === undefined || fixtureRowsAvailable === undefined) {
    return 'unknown';
  }
  return fixtureRowsAvailable >= expectedInputRows ? 'sufficient' : 'undersized';
}

function countPerfSeedRows(
  seedConfig: PerfSeedConfig,
  relationsUsed?: readonly string[]
): number | undefined {
  const normalizedRelations = normalizePerfRelationNames(relationsUsed);
  if (normalizedRelations.size === 0) {
    return undefined;
  }

  let matched = false;
  let rows = 0;
  for (const [tableName, tableSeed] of Object.entries(seedConfig.tables)) {
    if (!matchesPerfSeedRelation(tableName, normalizedRelations)) {
      continue;
    }
    matched = true;
    rows += tableSeed.rows;
  }

  return matched ? rows : undefined;
}

function discoverPerfQuerySpecMetadata(
  rootDir: string,
  queryFile: string
): DiscoveredPerfQuerySpecMetadata | undefined {
  const queryCandidates = buildPerfQuerySpecSqlCandidates(rootDir, queryFile);
  const matches: DiscoveredPerfQuerySpecMetadata[] = [];
  for (const relativeRoot of PERF_SPEC_DISCOVERY_ROOTS) {
    const absoluteRoot = path.resolve(rootDir, relativeRoot);
    if (!existsSync(absoluteRoot)) {
      continue;
    }

    for (const filePath of walkPerfSpecFiles(absoluteRoot)) {
      matches.push(...loadPerfQuerySpecMetadataFromFile(filePath, queryCandidates));
    }
  }

  if (matches.length <= 1) {
    return matches[0];
  }

  // Fail loudly when multiple specs claim the same SQL file so perf guidance stays deterministic.
  throw new Error(`Multiple QuerySpecs matched ${path.resolve(queryFile)}: ${matches.map((match) => `${match.specId} (${match.specFile})`).join(', ')}`);
}

function buildPerfQuerySpecSqlCandidates(rootDir: string, queryFile: string): Set<string> {
  const absoluteQueryFile = path.resolve(queryFile);
  const candidates = [
    path.relative(rootDir, absoluteQueryFile),
    path.relative(path.resolve(rootDir, 'src', 'sql'), absoluteQueryFile),
    path.relative(path.resolve(rootDir, 'sql'), absoluteQueryFile)
  ].map((value) => normalizePerfSpecPath(value))
    .filter((value) => value.length > 0 && !value.startsWith('..'));

  return new Set(candidates);
}

function normalizePerfSpecPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
}

function walkPerfSpecFiles(rootDir: string): string[] {
  const files: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (/\.(?:json|[cm]?[jt]s)$/iu.test(entry.name) && !/\.test\./iu.test(entry.name)) {
        files.push(absolute);
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function loadPerfQuerySpecMetadataFromFile(
  filePath: string,
  queryCandidates: Set<string>
): DiscoveredPerfQuerySpecMetadata[] {
  if (path.extname(filePath).toLowerCase() === '.json') {
    return loadPerfQuerySpecMetadataFromJson(filePath, queryCandidates);
  }

  const source = readFileSync(filePath, 'utf8');
  const discovered: DiscoveredPerfQuerySpecMetadata[] = [];
  for (const block of extractPerfQuerySpecBlocks(source)) {
    const parsed = parsePerfQuerySpecBlock(block, filePath, queryCandidates);
    if (parsed) {
      discovered.push(parsed);
    }
  }

  return discovered;
}

function loadPerfQuerySpecMetadataFromJson(
  filePath: string,
  queryCandidates: Set<string>
): DiscoveredPerfQuerySpecMetadata[] {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  if (Array.isArray(parsed)) {
    const matches: DiscoveredPerfQuerySpecMetadata[] = [];
    for (const entry of parsed) {
      const discovered = parsePerfQuerySpecObject(entry, filePath, queryCandidates);
      if (discovered) {
        matches.push(discovered);
      }
    }
    return matches;
  }
  if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { specs?: unknown[] }).specs)) {
    const matches: DiscoveredPerfQuerySpecMetadata[] = [];
    for (const entry of (parsed as { specs: unknown[] }).specs) {
      const discovered = parsePerfQuerySpecObject(entry, filePath, queryCandidates);
      if (discovered) {
        matches.push(discovered);
      }
    }
    return matches;
  }
  const discovered = parsePerfQuerySpecObject(parsed, filePath, queryCandidates);
  return discovered ? [discovered] : [];
}

function parsePerfQuerySpecObject(
  value: unknown,
  filePath: string,
  queryCandidates: Set<string>
): DiscoveredPerfQuerySpecMetadata | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const sqlFile = typeof record.sqlFile === 'string' ? record.sqlFile : undefined;
  if (!sqlFile || !matchesPerfQuerySpecSqlFile(queryCandidates, sqlFile)) {
    return undefined;
  }
  const metadata = typeof record.metadata === 'object' && record.metadata !== null
    ? record.metadata as Record<string, unknown>
    : undefined;
  const perf = metadata && typeof metadata.perf === 'object' && metadata.perf !== null
    ? metadata.perf as Record<string, unknown>
    : undefined;
  const expectedScale = normalizePerfExpectedScale(perf?.expectedScale ?? perf?.expected_scale);
  const expectedInputRows = normalizePerfMetadataNumber(perf?.expectedInputRows ?? perf?.expected_input_rows);
  const expectedOutputRows = normalizePerfMetadataNumber(perf?.expectedOutputRows ?? perf?.expected_output_rows);
  if (!expectedScale && expectedInputRows === undefined && expectedOutputRows === undefined) {
    return undefined;
  }
  return {
    specId: typeof record.id === 'string' ? record.id : normalizePerfSpecPath(sqlFile),
    specFile: filePath,
    expectedScale,
    expectedInputRows,
    expectedOutputRows
  };
}

function extractPerfQuerySpecBlocks(source: string): string[] {
  const blocks: string[] = [];
  const seen = new Set<string>();
  const sqlFileRegex = /sqlFile\s*:\s*['"`][^'"`\n]+['"`]/g;

  for (const match of source.matchAll(sqlFileRegex)) {
    if (typeof match.index !== 'number') {
      continue;
    }
    const start = source.lastIndexOf('{', match.index);
    if (start < 0) {
      continue;
    }
    let depth = 0;
    let end = -1;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }
    if (end < 0) {
      continue;
    }
    const block = source.slice(start, end + 1);
    if (!seen.has(block)) {
      seen.add(block);
      blocks.push(block);
    }
  }

  return blocks;
}

function parsePerfQuerySpecBlock(
  block: string,
  filePath: string,
  queryCandidates: Set<string>
): DiscoveredPerfQuerySpecMetadata | undefined {
  const sqlFile = block.match(/sqlFile\s*:\s*['"`]([^'"`\n]+)['"`]/u)?.[1];
  if (!sqlFile || !matchesPerfQuerySpecSqlFile(queryCandidates, sqlFile)) {
    return undefined;
  }
  const expectedScale = parsePerfExpectedScale(block);
  const expectedInputRows = parsePerfMetadataNumber(block, ['expectedInputRows', 'expected_input_rows']);
  const expectedOutputRows = parsePerfMetadataNumber(block, ['expectedOutputRows', 'expected_output_rows']);
  if (!expectedScale && expectedInputRows === undefined && expectedOutputRows === undefined) {
    return undefined;
  }
  const specId = block.match(/id\s*:\s*['"`]([^'"`\n]+)['"`]/u)?.[1] ?? normalizePerfSpecPath(sqlFile);
  return {
    specId,
    specFile: filePath,
    expectedScale,
    expectedInputRows,
    expectedOutputRows
  };
}

function matchesPerfQuerySpecSqlFile(queryCandidates: Set<string>, sqlFile: string): boolean {
  const normalizedSpecSqlFile = normalizePerfSpecPath(sqlFile);
  return queryCandidates.has(normalizedSpecSqlFile);
}

function parsePerfExpectedScale(block: string): PerfExpectedScale | undefined {
  const match = block.match(/expected(?:Scale|_scale)\s*:\s*['"`](tiny|small|medium|large|batch)['"`]/u);
  return normalizePerfExpectedScale(match?.[1]);
}

function parsePerfMetadataNumber(block: string, keys: string[]): number | undefined {
  for (const key of keys) {
    const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const match = block.match(new RegExp(`${escapedKey}\\s*:\\s*(\\d+(?:_\\d+)*(?:\\.\\d+)?)`, 'u'));
    const parsed = normalizePerfMetadataNumber(match?.[1]);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
}

function normalizePerfExpectedScale(value: unknown): PerfExpectedScale | undefined {
  return value === 'tiny' || value === 'small' || value === 'medium' || value === 'large' || value === 'batch'
    ? value
    : undefined;
}

function normalizePerfMetadataNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/_/g, ''));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  return undefined;
}

function normalizePerfRelationNames(relationsUsed?: readonly string[]): Set<string> {
  const normalized = new Set<string>();
  for (const relation of relationsUsed ?? []) {
    const relationName = normalizePerfRelationName(relation);
    if (!relationName) {
      continue;
    }
    normalized.add(relationName);

    const unqualified = relationName.split('.').at(-1);
    if (unqualified) {
      normalized.add(unqualified);
    }
  }
  return normalized;
}

function matchesPerfSeedRelation(tableName: string, relationsUsed: Set<string>): boolean {
  const normalizedTableName = normalizePerfRelationName(tableName);
  if (!normalizedTableName) {
    return false;
  }

  if (relationsUsed.has(normalizedTableName)) {
    return true;
  }

  const unqualified = normalizedTableName.split('.').at(-1);
  return Boolean(unqualified && relationsUsed.has(unqualified));
}

function normalizePerfRelationName(value: string): string {
  return value.trim().replace(/^"+|"+$/g, '').toLowerCase();
}

/**
 * Execute or plan a perf benchmark against the sandbox using either direct or decomposed execution.
 */
export async function runPerfBenchmark(options: PerfRunOptions): Promise<PerfBenchmarkReport> {
  const strategy = options.strategy ?? 'direct';
  const material = options.material ?? [];
  assertValidPerfRunOptions({ ...options, strategy, material });

  const prepared = prepareBenchmarkQuery(options.rootDir, options.queryFile, options.paramsFile);
  const pipelineAnalysis = buildPerfPipelineAnalysis(prepared.absolutePath);
  const strategyMetadata = buildRequestedStrategyMetadata(prepared.absolutePath, strategy, material);
  const classifyThresholdMs = options.classifyThresholdSeconds * 1000;
  const timeoutMs = options.timeoutMinutes * 60 * 1000;
    const seedConfig = loadPerfSeedConfig(options.rootDir);
  const specGuidance = buildPerfQuerySpecGuidance(options.rootDir, prepared.absolutePath, seedConfig, options.save, options.dryRun);
  const ddlInventory = inspectPerfDdlInventory(options.rootDir);
  const ddlInventorySummary = summarizePerfDdlInventory(ddlInventory);
  const databaseVersion = options.dryRun ? undefined : await fetchPerfDatabaseVersion(options.rootDir);

  const selection: PerfSelectionResult = options.dryRun
    ? {
        selectedMode: options.mode === 'auto' ? 'completion' : options.mode,
        reason: options.mode === 'auto'
          ? 'dry-run skips live auto classification; the real run will pick latency or completion after a thresholded probe'
          : 'mode forced by user'
      }
    : options.mode === 'auto'
    ? await classifyPerfBenchmarkMode(options.rootDir, prepared, strategy, material, classifyThresholdMs)
    : {
        selectedMode: options.mode,
        reason: 'mode forced by user'
      };

  if (options.dryRun) {
    const dryRunPlanFacts: PerfPlanFacts = {
      observations: [],
      statement_summary: '(no plan captured)',
      hasCapturedPlan: false,
      hasSequentialScan: false,
      hasJoin: false
    };
    const tuningGuidance = buildPerfTuningGuidance(pipelineAnalysis, dryRunPlanFacts, specGuidance);
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
      strategy: strategy,
      strategy_metadata: strategyMetadata,
      requested_mode: options.mode,
      selected_mode: selection.selectedMode,
      selection_reason: selection.reason,
      classify_threshold_ms: classifyThresholdMs,
      timeout_ms: timeoutMs,
      database_version: databaseVersion,
      dry_run: true,
      saved: false,
      classification_probe: selection.probe ? toPerfClassificationProbe(selection.probe) : undefined,
      executed_statements: buildDryRunStatements(prepared, strategy, strategyMetadata),
      plan_observations: [],
      recommended_actions: buildPerfRecommendedActions(selection.selectedMode, true, pipelineAnalysis, dryRunPlanFacts, specGuidance),
      pipeline_analysis: pipelineAnalysis,
      spec_guidance: specGuidance,
      ddl_inventory: ddlInventorySummary,
      tuning_guidance: tuningGuidance,
      tuning_summary: buildPerfTuningSummary(tuningGuidance),
      seed: { seed: seedConfig.seed }
    };
  }


  const latencyRuns: number[] = [];
  let representativeExecution: BenchmarkExecutionResult | undefined;
  let classificationProbe = selection.probe ? toPerfClassificationProbe(selection.probe) : undefined;

  if (selection.selectedMode === 'latency') {
    let remainingWarmups = options.warmup;
    let remainingMeasuredRuns = options.repeat;

    // Reuse the auto-classification probe so the benchmark does not hide an extra live execution.
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
      const warmupExecution = await executePerfBenchmarkOnce(options.rootDir, prepared, strategy, material, timeoutMs, false);
      if (warmupExecution.timedOut) {
        throw new Error('Latency benchmark timed out during warmup. Re-run with --mode completion or a larger timeout.');
      }
    }

    for (let index = 0; index < remainingMeasuredRuns; index += 1) {
      const execution = await executePerfBenchmarkOnce(
        options.rootDir,
        prepared,
        strategy,
        material,
        timeoutMs,
        !representativeExecution
      );
      if (execution.timedOut) {
        throw new Error('Latency benchmark timed out during a measured run. Re-run with --mode completion or a larger timeout.');
      }
      latencyRuns.push(execution.elapsedMs);
      if (!representativeExecution) {
        representativeExecution = execution;
      }
    }
  } else {
    if (selection.probe && !selection.probe.timedOut) {
      representativeExecution = selection.probe;
      classificationProbe = {
        ...toPerfClassificationProbe(selection.probe),
        reused_as_measured_run: true
      };
    } else {
      representativeExecution = await executePerfBenchmarkOnce(options.rootDir, prepared, strategy, material, timeoutMs, true);
    }
  }

  if (!representativeExecution) {
    throw new Error('Perf benchmark did not produce a representative execution.');
  }

  const executedStatements = toPerfStatementReports(representativeExecution.statements);
  const planFacts = buildPerfPlanFactsFromStatements(representativeExecution.statements);
  const tuningGuidance = buildPerfTuningGuidance(pipelineAnalysis, planFacts, specGuidance);
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
    strategy: strategy,
    strategy_metadata: representativeExecution.strategyMetadata ?? strategyMetadata,
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
      : representativeExecution.elapsedMs,
    latency_metrics: selection.selectedMode === 'latency'
      ? buildLatencyMetrics(latencyRuns, options.warmup)
      : undefined,
    completion_metrics: selection.selectedMode === 'completion'
      ? {
          completed: !representativeExecution.timedOut,
          timed_out: representativeExecution.timedOut,
          wall_time_ms: representativeExecution.elapsedMs
        }
      : undefined,
    executed_statements: executedStatements,
    plan_summary: summarizePlanJson(representativeExecution.finalPlanJson),
    plan_observations: planFacts.observations,
    recommended_actions: buildPerfRecommendedActions(
      selection.selectedMode,
      !representativeExecution.timedOut,
      pipelineAnalysis,
      planFacts,
      specGuidance
    ),
    pipeline_analysis: pipelineAnalysis,
    spec_guidance: specGuidance,
    ddl_inventory: ddlInventorySummary,
    tuning_guidance: tuningGuidance,
    tuning_summary: buildPerfTuningSummary(tuningGuidance),
    seed: { seed: seedConfig.seed }
  };

  if (options.save) {
    const persisted = savePerfBenchmarkEvidence(options.rootDir, report, representativeExecution.statements);
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
function buildRequestedStrategyMetadata(
  sqlFile: string,
  strategy: PerfExecutionStrategy,
  material: string[]
): PerfStrategyMetadata | undefined {
  if (strategy !== 'decomposed') {
    return undefined;
  }

  const plan = buildQueryPipelinePlan(sqlFile, { material });
  return toPerfStrategyMetadata(plan);
}

function buildDryRunStatements(
  prepared: PreparedBenchmarkQuery,
  strategy: PerfExecutionStrategy,
  strategyMetadata: PerfStrategyMetadata | undefined
): PerfStatementReport[] {
  if (strategy !== 'decomposed' || !strategyMetadata) {
    return [
      {
        seq: 1,
        role: 'final-query',
        target: 'FINAL_QUERY',
        sql: prepared.boundSql,
        bindings: prepared.bindings,
        resolved_sql_preview: renderResolvedSqlPreview(prepared.boundSql, prepared.bindings)
      }
    ];
  }

  return strategyMetadata.planned_steps.map((step) => ({
    seq: step.step,
    role: mapPipelineStepKindToRole(step.kind),
    target: step.target,
    sql: step.kind === 'materialize'
      ? `create temp table "${step.target.replace(/"/g, '""')}" as -- resolved at runtime`
      : prepared.boundSql,
    bindings: prepared.bindings,
    resolved_sql_preview: step.kind === 'materialize'
      ? `materialize ${step.target} from ${path.basename(prepared.absolutePath)}`
      : renderResolvedSqlPreview(prepared.boundSql, prepared.bindings)
  }));
}

async function executePerfBenchmarkOnce(
  rootDir: string,
  prepared: PreparedBenchmarkQuery,
  strategy: PerfExecutionStrategy,
  material: string[],
  timeoutMs: number,
  capturePlans: boolean
): Promise<BenchmarkExecutionResult> {
  return strategy === 'decomposed'
    ? executeDecomposedBenchmarkOnce(rootDir, prepared, material, timeoutMs, capturePlans)
    : executeDirectBenchmarkDetailed(rootDir, prepared, timeoutMs, capturePlans);
}

function preparePgStatementExecution(
  sql: string,
  params?: unknown[] | Record<string, unknown>
): { sql: string; bindings: unknown[] | undefined; resolvedSqlPreview?: string } {
  if (!params) {
    return { sql, bindings: undefined, resolvedSqlPreview: undefined };
  }

  if (Array.isArray(params)) {
    return {
      sql,
      bindings: params,
      resolvedSqlPreview: renderResolvedSqlPreview(sql, params)
    };
  }

  const scan = scanModelGenSql(sql);
  if (scan.mode !== 'named') {
    return { sql, bindings: undefined, resolvedSqlPreview: undefined };
  }

  const bound = bindModelGenNamedSql(sql);
  const bindings = bound.orderedParamNames.map((name) => {
    if (!(name in params)) {
      throw new Error(`Missing named pipeline param: ${name}`);
    }
    return params[name];
  });

  return {
    sql: bound.boundSql,
    bindings,
    resolvedSqlPreview: renderResolvedSqlPreview(bound.boundSql, bindings)
  };
}
function buildExplainTargetSql(sql: string): string {
  const match = /^create\s+temp\s+table\s+.+?\s+as\s+([\s\S]+)$/i.exec(sql.trim());
  return match?.[1]?.trim() || sql;
}


async function executeDirectBenchmarkDetailed(
  rootDir: string,
  prepared: PreparedBenchmarkQuery,
  timeoutMs: number,
  capturePlans: boolean
): Promise<BenchmarkExecutionResult> {
  const pg = await ensurePgModule();
  const sandboxConfig = loadPerfSandboxConfig(rootDir);
  const resolvedConnection = await ensurePerfConnection(rootDir, sandboxConfig);
  const client = new pg.Client({
    connectionString: resolvedConnection.connectionUrl,
    connectionTimeoutMillis: 3000
  });

  let statementTrace: StatementExecutionTrace;
  let finalPlanJson: unknown | null = null;
  try {
    await client.connect();
    await client.query(`SET statement_timeout = ${Math.max(1, Math.trunc(timeoutMs))}`);

    // Measure only live statement execution so connection/auth and plan capture do not pollute SQL latency.
    const startedAt = nowMs();
    const result = await client.query(prepared.boundSql, prepared.bindings as unknown[] | undefined);
    const elapsedMs = nowMs() - startedAt;

    if (capturePlans) {
      finalPlanJson = await capturePlanWithConnectedClient(
        client,
        prepared.boundSql,
        Array.isArray(prepared.bindings) ? prepared.bindings : undefined,
        true,
        timeoutMs
      );
    }

    statementTrace = {
      role: 'final-query',
      target: 'FINAL_QUERY',
      sql: prepared.boundSql,
      bindings: prepared.bindings,
      resolvedSqlPreview: renderResolvedSqlPreview(prepared.boundSql, prepared.bindings),
      elapsedMs,
      rowCount: extractRowCount(result as { rowCount?: number; rows?: unknown[] }),
      timedOut: false,
      planJson: finalPlanJson
    };
  } catch (error) {
    if (!isQueryTimeout(error)) {
      throw error;
    }
    statementTrace = {
      role: 'final-query',
      target: 'FINAL_QUERY',
      sql: prepared.boundSql,
      bindings: prepared.bindings,
      resolvedSqlPreview: renderResolvedSqlPreview(prepared.boundSql, prepared.bindings),
      elapsedMs: timeoutMs,
      timedOut: true
    };
  } finally {
    await client.end().catch(() => undefined);
  }

  return {
    elapsedMs: statementTrace.elapsedMs,
    rowCount: statementTrace.rowCount,
    timedOut: statementTrace.timedOut,
    statements: [statementTrace],
    finalPlanJson
  };
}

async function executeDecomposedBenchmarkOnce(
  rootDir: string,
  prepared: PreparedBenchmarkQuery,
  material: string[],
  timeoutMs: number,
  capturePlans: boolean
): Promise<BenchmarkExecutionResult> {
  const pg = await ensurePgModule();
  const sandboxConfig = loadPerfSandboxConfig(rootDir);
  const resolvedConnection = await ensurePerfConnection(rootDir, sandboxConfig);
  const plan = buildQueryPipelinePlan(prepared.absolutePath, { material });
  const rawStatements: Array<{
    sql: string;
    bindings: unknown[] | Record<string, unknown> | undefined;
    resolvedSqlPreview?: string;
    elapsedMs: number;
    rowCount?: number;
    timedOut: boolean;
    planJson?: unknown | null;
  }> = [];

  const client = new pg.Client({
    connectionString: resolvedConnection.connectionUrl,
    connectionTimeoutMillis: 3000
  });
  let totalElapsedMs = 0;
  const sessionFactory: QueryPipelineSessionFactory = {
    openSession: async (): Promise<QueryPipelineSession> => ({
      query: async (sql: string, params?: unknown[] | Record<string, unknown>) => {
        const execution = preparePgStatementExecution(sql, params);
        if (shouldSkipPerfStatementCapture(sql)) {
          return client.query(execution.sql, execution.bindings) as Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;
        }

        const remainingMs = Math.max(1, Math.trunc(timeoutMs - totalElapsedMs));
        await client.query(`SET statement_timeout = ${remainingMs}`);

        // Track total elapsed time across decomposed statements while keeping per-statement timings separate.
        const startedAt = nowMs();
        try {
          const result = await client.query(execution.sql, execution.bindings);
          const elapsedMs = nowMs() - startedAt;
          totalElapsedMs += elapsedMs;
          const planJson = capturePlans
            ? await capturePlanWithConnectedClient(
                client,
                buildExplainTargetSql(execution.sql),
                execution.bindings,
                false,
                remainingMs
              )
            : null;
          rawStatements.push({
            sql: execution.sql,
            bindings: execution.bindings,
            resolvedSqlPreview: execution.resolvedSqlPreview,
            elapsedMs,
            rowCount: extractRowCount(result as { rowCount?: number; rows?: unknown[] }),
            timedOut: false,
            planJson
          });
          return result as { rows: Record<string, unknown>[]; rowCount?: number };
        } catch (error) {
          if (!isQueryTimeout(error)) {
            throw error;
          }
          const elapsedMs = Math.min(timeoutMs, Math.max(remainingMs, nowMs() - startedAt));
          totalElapsedMs += elapsedMs;
          rawStatements.push({
            sql: execution.sql,
            bindings: execution.bindings,
            resolvedSqlPreview: execution.resolvedSqlPreview,
            elapsedMs,
            timedOut: true
          });
          throw error;
        }
      },
      end: async () => undefined
    })
  };

  try {
    await client.connect();
    const pipelineResult = await executeQueryPipeline(sessionFactory, {
      sqlFile: prepared.absolutePath,
      metadata: { material },
      params: prepared.runtimeBindings
    });
    const statements = mapPipelineStatements(rawStatements, toPerfPlannedSteps(pipelineResult.steps));
    const finalStatement = statements.find((statement) => statement.role === 'final-query');
    return {
      elapsedMs: totalElapsedMs,
      rowCount: pipelineResult.final.rowCount,
      timedOut: false,
      statements,
      finalPlanJson: finalStatement?.planJson ?? null,
      strategyMetadata: toPerfStrategyMetadata(plan)
    };
  } catch (error) {
    if (!isQueryTimeout(error)) {
      throw error;
    }
    const statements = mapPipelineStatements(rawStatements, toPerfPlannedSteps(plan.steps.slice(0, rawStatements.length)));
    const finalStatement = [...statements].reverse().find((statement) => statement.role === 'final-query');
    return {
      elapsedMs: totalElapsedMs,
      rowCount: finalStatement?.rowCount,
      timedOut: true,
      statements,
      finalPlanJson: finalStatement?.planJson ?? null,
      strategyMetadata: toPerfStrategyMetadata(plan)
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function capturePlanWithConnectedClient(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows?: Record<string, unknown>[] }> },
  sql: string,
  params: unknown[] | undefined,
  analyze: boolean,
  timeoutMs: number
): Promise<unknown | null> {
  const explainPrefix = analyze
    ? 'EXPLAIN (ANALYZE TRUE, BUFFERS TRUE, FORMAT JSON) '
    : 'EXPLAIN (FORMAT JSON) ';

  try {
    await client.query(`SET statement_timeout = ${Math.max(1, Math.trunc(timeoutMs))}`);
    const result = await client.query(`${explainPrefix}${sql}`, params as unknown[] | undefined);
    const firstRow = (result.rows?.[0] ?? {}) as Record<string, unknown>;
    return firstRow['QUERY PLAN'] ?? firstRow['query plan'] ?? null;
  } catch (error) {
    if (isQueryTimeout(error)) {
      return null;
    }
    throw error;
  }
}

export function toPerfPlannedSteps(
  steps: Array<{ kind: PerfStatementRole | QueryPipelineStep['kind']; target: string }>
): Array<{ kind: PerfStatementRole; target: string }> {
  return steps
    // scalar-filter-bind is emitted by execution tracing, not QueryPipelinePlan metadata.
    .filter((step) => step.kind !== 'scalar-filter-bind')
    .map((step) => ({
      kind: mapPipelineStepKindToRole(step.kind as QueryPipelineStep['kind']),
      target: step.target
    }));
}

export function mapPipelineStatements(
  statements: Array<{
    sql: string;
    bindings: unknown[] | Record<string, unknown> | undefined;
    resolvedSqlPreview?: string;
    elapsedMs: number;
    rowCount?: number;
    timedOut: boolean;
    planJson?: unknown | null;
  }>,
  plannedSteps?: Array<{ kind: PerfStatementRole; target: string }>
): StatementExecutionTrace[] {
  return statements.map((statement, index) => ({
    role: plannedSteps?.[index]?.kind ?? (index === statements.length - 1 ? 'final-query' : 'materialize'),
    target: plannedSteps?.[index]?.target ?? (index === statements.length - 1 ? 'FINAL_QUERY' : `stage_${index + 1}`),
    sql: statement.sql,
    bindings: statement.bindings,
    resolvedSqlPreview: statement.resolvedSqlPreview,
    elapsedMs: statement.elapsedMs,
    rowCount: statement.rowCount,
    timedOut: statement.timedOut,
    planJson: statement.planJson ?? null
  }));
}

function mapPipelineStepKindToRole(kind: QueryPipelineStep['kind']): PerfStatementRole {
  return kind === 'materialize' ? 'materialize' : 'final-query';
}

function shouldSkipPerfStatementCapture(sql: string): boolean {
  return /^\s*drop\s+table\s+if\s+exists\b/i.test(sql);
}

function toPerfStrategyMetadata(plan: ReturnType<typeof buildQueryPipelinePlan>): PerfStrategyMetadata {
  return {
    materialized_ctes: [...plan.metadata.material],
    scalar_filter_columns: [...plan.metadata.scalarFilterColumns],
    planned_steps: plan.steps.map((step) => ({
      step: step.step,
      kind: step.kind,
      target: step.target,
      depends_on: [...step.depends_on]
    }))
  };
}

function toPerfStatementReports(statements: StatementExecutionTrace[]): PerfStatementReport[] {
  return statements.map((statement, index) => ({
    seq: index + 1,
    role: statement.role,
    target: statement.target,
    sql: statement.sql,
    bindings: statement.bindings,
    resolved_sql_preview: statement.resolvedSqlPreview,
    row_count: statement.rowCount,
    elapsed_ms: statement.elapsedMs,
    timed_out: statement.timedOut,
    plan_summary: summarizePlanJson(statement.planJson)
  }));
}

function buildPerfPlanFactsFromStatements(statements: StatementExecutionTrace[]): PerfPlanFacts {
  const observations: string[] = [];
  const summaries: string[] = [];
  let hasCapturedPlan = false;
  let hasSequentialScan = false;
  let hasJoin = false;

  for (const statement of statements) {
    const facts = buildPerfPlanFacts(statement.planJson ?? null);
    const prefix = `${statement.role}(${statement.target})`;
    summaries.push(`${prefix}: ${facts.statement_summary}`);
    observations.push(...facts.observations.map((observation) => `${prefix}: ${observation}`));
    hasCapturedPlan = hasCapturedPlan || facts.hasCapturedPlan;
    hasSequentialScan = hasSequentialScan || facts.hasSequentialScan;
    hasJoin = hasJoin || facts.hasJoin;
  }

  return {
    observations: Array.from(new Set(observations)),
    statement_summary: summaries.join(' | ') || '(no plan captured)',
    hasCapturedPlan,
    hasSequentialScan,
    hasJoin
  };
}
/**
 * Compare two saved benchmark evidence directories for AI-friendly tuning decisions.
 */
export function diffPerfBenchmarkReports(baselineDir: string, candidateDir: string): PerfDiffReport {
  const baseline = loadPerfBenchmarkReport(baselineDir);
  const candidate = loadPerfBenchmarkReport(candidateDir);
  const notes: string[] = [];
  const modeChanged = baseline.selected_mode !== candidate.selected_mode;
  const strategyChanged = baseline.strategy !== candidate.strategy;
  const statementsDelta = candidate.executed_statements.length - baseline.executed_statements.length;
  const statementDeltas = buildPerfStatementDeltas(baseline, candidate);
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
  if (strategyChanged) {
    notes.push(`Strategy changed from ${baseline.strategy} to ${candidate.strategy}.`);
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
    strategy_changed: strategyChanged,
    statements_delta: statementsDelta,
    statement_deltas: statementDeltas,
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


  if (report.tuning_summary) {
    lines.push(`Decision summary: ${report.tuning_summary.headline}`);
    for (const evidence of report.tuning_summary.evidence) {
      lines.push(`  evidence: ${evidence}`);
    }
    lines.push(`  next: ${report.tuning_summary.next_step}`);
  }
  lines.push('');
  if (report.spec_guidance) {
    lines.push('');
    lines.push('Query spec guidance:');
    lines.push(`  spec_id: ${report.spec_guidance.spec_id}`);
    lines.push(`  spec_file: ${report.spec_guidance.spec_file}`);
    lines.push(`  expected_scale: ${report.spec_guidance.expected_scale ?? '(unspecified)'}`);
    lines.push(`  review_policy: ${report.spec_guidance.review_policy}`);
    lines.push(`  evidence_status: ${report.spec_guidance.evidence_status}`);
    lines.push(`  fixture_rows_available: ${report.spec_guidance.fixture_rows_available ?? '(unknown)'}`);
    lines.push(`  fixture_rows_status: ${report.spec_guidance.fixture_rows_status}`);
    if (report.spec_guidance.expected_input_rows !== undefined) {
      lines.push(`  expected_input_rows: ${report.spec_guidance.expected_input_rows}`);
    }
    if (report.spec_guidance.expected_output_rows !== undefined) {
      lines.push(`  expected_output_rows: ${report.spec_guidance.expected_output_rows}`);
    }
    lines.push('');
  }
  if (report.ddl_inventory) {
    lines.push('DDL inventory:');
    lines.push(`  ddl_files: ${report.ddl_inventory.ddl_files}`);
    lines.push(`  ddl_statement_count: ${report.ddl_inventory.ddl_statement_count}`);
    lines.push(`  table_count: ${report.ddl_inventory.table_count}`);
    lines.push(`  index_count: ${report.ddl_inventory.index_count}`);
    lines.push(`  index_names: ${report.ddl_inventory.index_names.length > 0 ? report.ddl_inventory.index_names.join(', ') : '(none)'}`);
    lines.push('');
  }
  if (report.tuning_guidance) {
    lines.push('Tuning guidance:');
    lines.push(`  primary_path: ${report.tuning_guidance.primary_path}`);
    lines.push(`  requires_captured_plan: ${report.tuning_guidance.requires_captured_plan ? 'yes' : 'no'}`);
    lines.push(`  index_branch: ${report.tuning_guidance.index_branch.recommended ? 'recommended' : 'secondary'}`);
    for (const rationale of report.tuning_guidance.index_branch.rationale) {
      lines.push(`    rationale: ${rationale}`);
    }
    for (const step of report.tuning_guidance.index_branch.next_steps) {
      lines.push(`    next: ${step}`);
    }
    lines.push(`  pipeline_branch: ${report.tuning_guidance.pipeline_branch.recommended ? 'recommended' : 'secondary'}`);
    for (const rationale of report.tuning_guidance.pipeline_branch.rationale) {
      lines.push(`    rationale: ${rationale}`);
    }
    for (const step of report.tuning_guidance.pipeline_branch.next_steps) {
      lines.push(`    next: ${step}`);
    }
    lines.push('');
  }
  lines.push('Executed statements:');
  for (const statement of report.executed_statements) {
    const statementLabel = statement.target ? `${statement.seq}. ${statement.role} (${statement.target})` : `${statement.seq}. ${statement.role}`;
    lines.push(statementLabel);
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
    if (statement.plan_file) {
      lines.push(`   plan_file: ${statement.plan_file}`);
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

  if (report.strategy_metadata) {
    lines.push('');
    lines.push('Strategy metadata:');
    lines.push(`  materialized_ctes: ${report.strategy_metadata.materialized_ctes.length > 0 ? report.strategy_metadata.materialized_ctes.join(', ') : '(none)'}`);
    lines.push(`  scalar_filter_columns: ${report.strategy_metadata.scalar_filter_columns.length > 0 ? report.strategy_metadata.scalar_filter_columns.join(', ') : '(none)'}`);
    for (const step of report.strategy_metadata.planned_steps) {
      lines.push(`  - step ${step.step}: ${step.kind} ${step.target} <= ${step.depends_on.length > 0 ? step.depends_on.join(', ') : '(root)'}`);
    }
  }

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

export function formatPerfDiffReport(report: PerfDiffReport, format: PerfBenchmarkFormat): string {
  if (format === 'json') {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  const statementDeltas = report.statement_deltas ?? [];

  const lines = [
    `Baseline mode: ${report.baseline_mode}`,
    `Candidate mode: ${report.candidate_mode}`,
    `Baseline strategy: ${report.baseline_strategy}`,
    `Candidate strategy: ${report.candidate_strategy}`,
    `Primary metric: ${report.primary_metric.name}`,
    `Baseline: ${report.primary_metric.baseline.toFixed(2)}`,
    `Candidate: ${report.primary_metric.candidate.toFixed(2)}`,
    `Improvement: ${report.primary_metric.improvement_percent.toFixed(2)}%`,
    `Statements delta: ${report.statements_delta}`,
  ];

  if (statementDeltas.some((delta) => delta.elapsed_delta_ms !== undefined || delta.baseline_timed_out !== delta.candidate_timed_out)) {
    lines.push('');
    lines.push('Statement deltas:');
    for (const delta of statementDeltas) {
      const elapsed = delta.elapsed_delta_ms !== undefined
        ? `${delta.elapsed_delta_ms >= 0 ? '+' : ''}${delta.elapsed_delta_ms.toFixed(2)} ms`
        : '(n/a)';
      lines.push(`- ${delta.statement_id}: baseline=${delta.baseline_elapsed_ms ?? '(n/a)'} candidate=${delta.candidate_elapsed_ms ?? '(n/a)'} delta=${elapsed}`);
    }
  }

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
export function summarizePerfDdlInventory(inventory: PerfDdlInventory): PerfDdlInventorySummary {
  return {
    ddl_files: inventory.files.length,
    ddl_statement_count: inventory.ddlStatementCount,
    table_count: inventory.tableCount,
    index_count: inventory.indexCount,
    index_names: [...inventory.indexNames]
  };
}

export function buildPerfTuningGuidance(
  pipelineAnalysis: PerfPipelineAnalysis,
  planFacts: PerfPlanFacts,
  specGuidance?: PerfQuerySpecGuidance
): PerfTuningGuidance {
  const indexRationale: string[] = [];
  const indexNextSteps = [
    'Capture or review EXPLAIN (ANALYZE, BUFFERS) before changing the physical design.',
    'Append CREATE INDEX statements to ztd/ddl/*.sql instead of making ad-hoc sandbox-only changes.',
    'Run `ztd perf db reset` so the perf sandbox recreates both tables and indexes from local DDL.'
  ];
  const pipelineRationale: string[] = [];
  const pipelineNextSteps = [
    'Review candidate_ctes and scalar_filter_candidates before rewriting the query.',
    'Use PIPELINE decomposition when the same intermediate result is reused or scalar filters are optimizer-sensitive.',
    'After SQL changes, rerun `ztd perf db reset` and `ztd perf seed` so the benchmark uses the intended physical schema.'
  ];

  const hasPipelineSignals = pipelineAnalysis.should_consider_pipeline
    || pipelineAnalysis.candidate_ctes.length > 0
    || pipelineAnalysis.scalar_filter_candidates.length > 0;
  const hasPlanSignals = planFacts.hasSequentialScan || planFacts.hasJoin;

  if (pipelineAnalysis.candidate_ctes.length > 0) {
    pipelineRationale.push('Reusable intermediate stages detected: ' + pipelineAnalysis.candidate_ctes.map((candidate) => candidate.name).join(', ') + '.');
  }
  if (pipelineAnalysis.scalar_filter_candidates.length > 0) {
    pipelineRationale.push('Optimizer-sensitive scalar predicates detected: ' + pipelineAnalysis.scalar_filter_candidates.join(', ') + '.');
  }
  if (planFacts.hasSequentialScan) {
    indexRationale.push('Captured plan shows a sequential scan, so index coverage is the first physical-design branch to review.');
  }
  if (planFacts.hasJoin) {
    indexRationale.push('Captured plan shows join work, so supporting indexes or join-order changes may matter.');
  }
  if (specGuidance?.review_policy === 'strongly-recommended') {
    indexRationale.push('QuerySpec marks this query as performance-sensitive, so preserve physical design changes in local DDL before benchmarking.');
  }

  let primaryPath: PerfTuningPrimaryPath = 'capture-plan';
  if (hasPipelineSignals) {
    primaryPath = 'pipeline';
  }
  if (hasPlanSignals && !hasPipelineSignals) {
    primaryPath = 'index';
  }

  if (primaryPath === 'capture-plan' && indexRationale.length === 0) {
    indexRationale.push('No captured plan is available yet, so confirm whether scans or joins are the real bottleneck before adding indexes.');
  }
  if (primaryPath === 'capture-plan' && pipelineRationale.length === 0) {
    pipelineRationale.push('No pipeline-specific signal is available yet, so start by capturing a representative plan and row counts.');
  }

  return {
    primary_path: primaryPath,
    requires_captured_plan: !planFacts.hasCapturedPlan,
    index_branch: {
      recommended: primaryPath === 'index',
      rationale: indexRationale,
      next_steps: indexNextSteps
    },
    pipeline_branch: {
      recommended: primaryPath === 'pipeline',
      rationale: pipelineRationale,
      next_steps: pipelineNextSteps
    }
  };
}
export function buildPerfTuningSummary(guidance: PerfTuningGuidance): PerfTuningSummary {
  if (guidance.primary_path === 'index') {
    return {
      headline: 'Start with index tuning.',
      evidence: guidance.index_branch.rationale.slice(0, 2),
      next_step: guidance.index_branch.next_steps[0] ?? 'Review the captured plan before changing indexes.'
    };
  }

  if (guidance.primary_path === 'pipeline') {
    return {
      headline: 'Start with pipeline tuning.',
      evidence: guidance.pipeline_branch.rationale.slice(0, 2),
      next_step: guidance.pipeline_branch.next_steps[0] ?? 'Review candidate_ctes before rewriting the query.'
    };
  }

  return {
    headline: 'Capture a representative plan before choosing index or pipeline work.',
    evidence: [
      'No captured plan signal is available yet.',
      ...guidance.index_branch.rationale.slice(0, 1)
    ],
    next_step: guidance.index_branch.next_steps[0] ?? 'Capture EXPLAIN (ANALYZE, BUFFERS) output first.'
  };
}

function buildPerfRecommendedActions(
  selectedMode: PerfSelectedBenchmarkMode,
  completed: boolean,
  pipelineAnalysis: PerfPipelineAnalysis,
  planFacts: PerfPlanFacts,
  specGuidance?: PerfQuerySpecGuidance
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
  if (specGuidance?.evidence_status === 'missing') {
    actions.push({
      action: 'capture-perf-evidence',
      priority: 'high',
      rationale: `QuerySpec guidance marks this query as ${specGuidance.expected_scale ?? 'performance-sensitive'}, so save benchmark evidence for maintenance review.`
    });
  }
  if (specGuidance?.fixture_rows_status === 'undersized' && specGuidance.expected_input_rows !== undefined) {
    actions.push({
      action: 'increase-perf-fixture-scale',
      priority: specGuidance.review_policy === 'strongly-recommended' ? 'high' : 'medium',
      rationale: `perf/seed.yml currently provisions ${specGuidance.fixture_rows_available} rows, below the expected input scale of ${specGuidance.expected_input_rows}.`
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
  const hasCapturedPlan = planJson !== null && planJson !== undefined;
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
    hasCapturedPlan,
    hasSequentialScan,
    hasJoin
  };
}

function buildPerfPlanDeltas(baseline: PerfBenchmarkReport, candidate: PerfBenchmarkReport): PerfPlanDelta[] {
  const keys = collectPerfStatementDiffKeys(baseline.executed_statements, candidate.executed_statements);
  const baselineLookup = buildPerfStatementDiffLookup(baseline.executed_statements);
  const candidateLookup = buildPerfStatementDiffLookup(candidate.executed_statements);
  const deltas: PerfPlanDelta[] = [];

  for (const key of keys) {
    const baselineStatement = baselineLookup.get(key);
    const candidateStatement = candidateLookup.get(key);
    const statementId = formatPlanDeltaStatementId(candidateStatement ?? baselineStatement, key);
    const baselinePlan = summarizeStatementPlan(baselineStatement, baseline.plan_observations, true);
    const candidatePlan = summarizeStatementPlan(candidateStatement, candidate.plan_observations, true);
    deltas.push({
      statement_id: statementId,
      baseline_plan: baselinePlan,
      candidate_plan: candidatePlan,
      changed: baselinePlan !== candidatePlan
    });
  }

  return deltas;
}

function buildPerfStatementDeltas(baseline: PerfBenchmarkReport, candidate: PerfBenchmarkReport): PerfStatementDelta[] {
  const keys = collectPerfStatementDiffKeys(baseline.executed_statements, candidate.executed_statements);
  const baselineLookup = buildPerfStatementDiffLookup(baseline.executed_statements);
  const candidateLookup = buildPerfStatementDiffLookup(candidate.executed_statements);
  const deltas: PerfStatementDelta[] = [];

  for (const key of keys) {
    const baselineStatement = baselineLookup.get(key);
    const candidateStatement = candidateLookup.get(key);
    const statement = candidateStatement ?? baselineStatement;
    deltas.push({
      statement_id: formatPlanDeltaStatementId(statement, key),
      role: statement?.role ?? 'final-query',
      baseline_elapsed_ms: baselineStatement?.elapsed_ms,
      candidate_elapsed_ms: candidateStatement?.elapsed_ms,
      elapsed_delta_ms:
        baselineStatement?.elapsed_ms !== undefined && candidateStatement?.elapsed_ms !== undefined
          ? candidateStatement.elapsed_ms - baselineStatement.elapsed_ms
          : undefined,
      baseline_row_count: baselineStatement?.row_count,
      candidate_row_count: candidateStatement?.row_count,
      baseline_timed_out: baselineStatement?.timed_out,
      candidate_timed_out: candidateStatement?.timed_out
    });
  }

  return deltas;
}

function buildPerfStatementDiffLookup(statements: PerfStatementReport[]): Map<string, PerfStatementReport> {
  return new Map(buildPerfStatementDiffEntries(statements).map((entry) => [entry.key, entry.statement]));
}

function collectPerfStatementDiffKeys(
  baselineStatements: PerfStatementReport[],
  candidateStatements: PerfStatementReport[]
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const entry of [...buildPerfStatementDiffEntries(baselineStatements), ...buildPerfStatementDiffEntries(candidateStatements)]) {
    if (seen.has(entry.key)) {
      continue;
    }
    seen.add(entry.key);
    keys.push(entry.key);
  }
  return keys;
}

function buildPerfStatementDiffEntries(
  statements: PerfStatementReport[]
): Array<{ key: string; statement: PerfStatementReport }> {
  const counts = new Map<string, number>();
  return statements.map((statement) => {
    const baseKey = statement.target ? `${statement.role}:${statement.target}` : `${statement.role}:statement`;
    const nextCount = (counts.get(baseKey) ?? 0) + 1;
    counts.set(baseKey, nextCount);
    return {
      key: nextCount === 1 ? baseKey : `${baseKey}#${nextCount}`,
      statement
    };
  });
}

function formatPlanDeltaStatementId(statement: PerfStatementReport | undefined, fallbackKey: string): string {
  if (!statement) {
    return fallbackKey;
  }
  return statement.target ? `${statement.seq}:${statement.role}:${statement.target}` : `${statement.seq}:${statement.role}`;
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
    const prefix = `${statement.role}(${statement.target ?? 'statement'})`;
    const relevantObservations = planObservations.filter((observation) => observation.startsWith(prefix));
    if (relevantObservations.length > 0) {
      parts.push(relevantObservations.join(' | '));
    }
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
    const namedBindings = rawBindings as Record<string, unknown>;
    const bound = bindModelGenNamedSql(sourceSql);
    const orderedValues = bound.orderedParamNames.map((name) => {
      if (!(name in namedBindings)) {
        throw new Error(`Missing named benchmark param: ${name}`);
      }
      return namedBindings[name];
    });
    return {
      absolutePath,
      sourceSql,
      boundSql: bound.boundSql,
      queryType: 'SELECT',
      paramsShape: scan.mode,
      orderedParamNames: bound.orderedParamNames,
      bindings: orderedValues,
      runtimeBindings: namedBindings
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
      bindings: rawBindings,
      runtimeBindings: rawBindings
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
    bindings: undefined,
    runtimeBindings: undefined
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
  strategy: PerfExecutionStrategy,
  material: string[],
  classifyThresholdMs: number
): Promise<PerfSelectionResult> {
  const probe = await executePerfBenchmarkOnce(rootDir, prepared, strategy, material, classifyThresholdMs, true);
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
  statements: StatementExecutionTrace[]
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
  for (const [index, statement] of report.executed_statements.entries()) {
    const trace = statements[index];
    const targetSuffix = statement.target ? `-${sanitizeLabel(statement.target)}` : '';
    const baseName = `${String(statement.seq).padStart(3, '0')}-${statement.role}${targetSuffix}`;
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

    if (trace?.planJson !== undefined && trace.planJson !== null) {
      const planFileName = `${baseName}.plan.json`;
      const relativePlanPath = path.join('plans', planFileName).replace(/\\/g, '/');
      writeFileSync(path.join(plansDir, planFileName), `${JSON.stringify(trace.planJson, null, 2)}\n`, 'utf8');
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

function toPerfClassificationProbe(result: BenchmarkExecutionResult): PerfClassificationProbe {
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
  if (report.query_type !== 'SELECT' || !isPerfExecutionStrategy(report.strategy)) {
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
  if (!isPerfPipelineAnalysis(report.pipeline_analysis)
    || !isOptionalPerfClassificationProbe(report.classification_probe)
    || !isOptionalPerfQuerySpecGuidance(report.spec_guidance)
    || !isOptionalPerfDdlInventorySummary(report.ddl_inventory)
    || !isOptionalPerfTuningGuidance(report.tuning_guidance)
    || !isOptionalPerfTuningSummary(report.tuning_summary)) {
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
    && isOptionalCompletionMetrics(report.completion_metrics)
    && isOptionalPerfStrategyMetadata(report.strategy_metadata);
}

function isOptionalPerfQuerySpecGuidance(value: unknown): value is PerfQuerySpecGuidance | undefined {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const guidance = value as Record<string, unknown>;
  return typeof guidance.spec_id === 'string'
    && typeof guidance.spec_file === 'string'
    && isOptionalPerfExpectedScale(guidance.expected_scale)
    && isOptionalNumber(guidance.expected_input_rows)
    && isOptionalNumber(guidance.expected_output_rows)
    && isPerfReviewPolicy(guidance.review_policy)
    && isPerfEvidenceStatus(guidance.evidence_status)
    && isOptionalNumber(guidance.fixture_rows_available)
    && isPerfFixtureRowsStatus(guidance.fixture_rows_status);
}

function isOptionalPerfDdlInventorySummary(value: unknown): value is PerfDdlInventorySummary | undefined {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const inventory = value as Record<string, unknown>;
  return typeof inventory.ddl_files === 'number'
    && typeof inventory.ddl_statement_count === 'number'
    && typeof inventory.table_count === 'number'
    && typeof inventory.index_count === 'number'
    && isStringArray(inventory.index_names);
}

function isOptionalPerfTuningGuidance(value: unknown): value is PerfTuningGuidance | undefined {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const guidance = value as Record<string, unknown>;
  return isPerfTuningPrimaryPath(guidance.primary_path)
    && typeof guidance.requires_captured_plan === 'boolean'
    && isPerfTuningBranchGuidance(guidance.index_branch)
    && isPerfTuningBranchGuidance(guidance.pipeline_branch);
}

function isPerfTuningPrimaryPath(value: unknown): value is PerfTuningPrimaryPath {
  return value === 'index' || value === 'pipeline' || value === 'capture-plan';
}

function isOptionalPerfTuningSummary(value: unknown): value is PerfTuningSummary | undefined {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const summary = value as Record<string, unknown>;
  return typeof summary.headline === 'string'
    && isStringArray(summary.evidence)
    && typeof summary.next_step === 'string';
}

function isPerfTuningBranchGuidance(value: unknown): value is PerfTuningBranchGuidance {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const guidance = value as Record<string, unknown>;
  return typeof guidance.recommended === 'boolean'
    && isStringArray(guidance.rationale)
    && isStringArray(guidance.next_steps);
}
function isOptionalPerfExpectedScale(value: unknown): value is PerfExpectedScale | undefined {
  return value === undefined || value === 'tiny' || value === 'small' || value === 'medium' || value === 'large' || value === 'batch';
}

function isPerfReviewPolicy(value: unknown): value is PerfReviewPolicy {
  return value === 'none' || value === 'recommended' || value === 'strongly-recommended';
}

function isPerfEvidenceStatus(value: unknown): value is PerfEvidenceStatus {
  return value === 'captured' || value === 'missing' || value === 'not-required';
}

function isPerfFixtureRowsStatus(value: unknown): value is PerfFixtureRowsStatus {
  return value === 'sufficient' || value === 'undersized' || value === 'unknown';
}

function isPerfExecutionStrategy(value: unknown): value is PerfExecutionStrategy {
  return value === 'direct' || value === 'decomposed';
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
  // Older saved summaries may not include scalar_filter_candidates.
  // Treat the field as optional so perf diff remains backward-compatible.
  return typeof analysis.query_type === 'string'
    && typeof analysis.cte_count === 'number'
    && typeof analysis.should_consider_pipeline === 'boolean'
    && isPerfPipelineCandidateArray(analysis.candidate_ctes)
    && (analysis.scalar_filter_candidates === undefined || isStringArray(analysis.scalar_filter_candidates))
    && isStringArray(analysis.notes);
}

function isPerfPipelineCandidateArray(value: unknown): value is PerfPipelineCandidate[] {
  return Array.isArray(value) && value.every((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }
    const record = candidate as Record<string, unknown>;
    return typeof record.name === 'string'
      && typeof record.downstream_references === 'number'
      && isStringArray(record.reasons);
  });
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
    && isPerfStatementRole(statement.role)
    && typeof statement.sql === 'string'
    && isOptionalString(statement.target)
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

function isPerfStatementRole(value: unknown): value is PerfStatementRole {
  return value === 'materialize' || value === 'scalar-filter-bind' || value === 'final-query';
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

function isOptionalPerfStrategyMetadata(value: unknown): value is PerfStrategyMetadata | undefined {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const metadata = value as Record<string, unknown>;
  return isStringArray(metadata.materialized_ctes)
    && isStringArray(metadata.scalar_filter_columns)
    && Array.isArray(metadata.planned_steps)
    && metadata.planned_steps.every((step) => {
      if (typeof step !== 'object' || step === null) {
        return false;
      }
      const record = step as Record<string, unknown>;
      return typeof record.step === 'number'
        && (record.kind === 'materialize' || record.kind === 'final-query')
        && typeof record.target === 'string'
        && isStringArray(record.depends_on);
    });
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

