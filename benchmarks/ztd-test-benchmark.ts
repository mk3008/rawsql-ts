import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import {
  CUSTOMER_ROWS,
  PRODUCT_ROWS,
  SALES_ORDER_ITEM_ROWS,
  SALES_ORDER_ROWS,
  TRADITIONAL_CASES,
} from './support/traditional-bench-data';
import {
  runCustomerSummaryCase,
  runProductRankingCase,
  runSalesSummaryCase,
} from './ztd-bench/tests/support/ztd-bench-cases';
import type { ZtdBenchMetrics } from './ztd-bench/tests/support/testkit-client';
import { buildBenchSchemaName } from './ztd-bench/tests/support/bench-suite';
import {
  ConnectionLogger,
  ConnectionModel,
  RunPhase,
  clearConnectionEvents,
  clearSessionStats,
  recordConnectionEvent,
  recordSessionStat,
} from './ztd-bench/tests/support/diagnostics';
import { getDbClient, releaseWorkerClient, closeDbPool } from './support/db-client';
import { runTraditionalParallelismValidation } from './support/traditional-parallelism-validation';
import { safeStopSampler, SessionSampler } from './support/session-sampler';
import {
  BenchContext,
  BenchPhaseLogEntry,
  closeBenchmarkLogger,
  configureBenchmarkLogger,
  getBenchPhaseEntries,
  logBenchPhase,
  logBenchProgress,
} from './support/benchmark-logger';
import {
  clearZtdDiagnostics,
  getZtdSessionMap,
  getZtdWaitingMap,
  recordZtdSession,
} from './ztd-bench/tests/support/bench-diagnostics';

type ExecutionMode = 'serial' | 'parallel';
type Scenario =
  | 'ztd-runner'
  | 'traditional-runner'
  | 'traditional-in-process'
  | 'ztd-in-process'
  | 'ztd-steady-state'
  | 'traditional-steady-state';
type BenchProfileName = 'quick' | 'dev' | 'ci';
type BenchProfile = {
  name: BenchProfileName;
  defaults: {
    warmupRuns: number;
    measuredRuns: number;
    suiteMultipliers: number[];
    steadyStateIterations: number;
    steadyStateSuiteMultiplier: number;
  };
};
type BenchScenarioSelection = {
  label: string;
  includeRunner: boolean;
  includeSteady: boolean;
  includeLowerBound: boolean;
};

type SteadyStateMetrics = {
  iterationTotalMs: number[];
  iterationSqlCount: number[];
  iterationDbMs: number[];
  iterationRewriteMs?: number[];
  iterationFixtureMs?: number[];
  iterationSqlGenerationMs?: number[];
  iterationOtherMs?: number[];
};

type RunMetrics = {
  scenario: Scenario;
  phase: RunPhase;
  mode: ExecutionMode;
  durationMs: number;
  suiteMultiplier: number;
  suiteSize: number;
  sqlCount?: number;
  totalDbMs?: number;
  totalQueryMs?: number;
  rewriteMs?: number;
  fixtureMaterializationMs?: number;
  sqlGenerationMs?: number;
  otherProcessingMs?: number;
  startupMs?: number;
  executionMs?: number;
  perTestMs?: number;
  startupShare?: number;
  executionShare?: number;
  steadyState?: SteadyStateMetrics;
  parallelWorkerCount?: number;
  traditionalPeakConnections?: number;
  traditionalCasesPerWorker?: Record<string, number>;
  runIndex?: number;
  traditionalWorkerTimeRanges?: WorkerTimeRange[];
};

type MetricsStatusEntry = {
  scenario: Scenario;
  mode: ExecutionMode;
  suiteMultiplier: number;
  phase: RunPhase;
  runIndex: number;
  metricsPresent: boolean;
  usedFiles: string[];
  missingFiles: string[];
};

type WorkerActivity = {
  connectionModel: ConnectionModel;
  scenarioLabel: string;
  mode: ExecutionMode;
  workerId: string;
  cases: number;
  startMs?: number;
  endMs?: number;
  migrationStatements: number;
};

const workerActivities = new Map<string, WorkerActivity>();

type WorkerTimeRange = {
  workerId: string;
  cases: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
};

type TraditionalParallelDiagnostic = {
  casesPerWorker: Map<string, number>;
  activeConnections: number;
  peakConnections: number;
};

let currentTraditionalDiagnostic: TraditionalParallelDiagnostic | null = null;
const parallelValidationTokens = new Set<string>();

function normalizeWorkerId(workerId?: string): string {
  return workerId && workerId.length > 0 ? workerId : 'unknown';
}

function buildWorkerActivityKey(
  connectionModel: ConnectionModel,
  scenarioLabel: string,
  mode: ExecutionMode,
  workerId: string,
): string {
  return `${connectionModel}|${scenarioLabel}|${mode}|${workerId}`;
}

function getOrCreateWorkerActivity(
  connectionModel: ConnectionModel,
  scenarioLabel: string,
  mode: ExecutionMode,
  workerId: string,
): WorkerActivity {
  const normalizedWorker = normalizeWorkerId(workerId);
  const key = buildWorkerActivityKey(connectionModel, scenarioLabel, mode, normalizedWorker);
  let activity = workerActivities.get(key);
  if (!activity) {
    activity = {
      connectionModel,
      scenarioLabel,
      mode,
      workerId: normalizedWorker,
      cases: 0,
      migrationStatements: 0,
    };
    workerActivities.set(key, activity);
  }
  return activity;
}

function recordWorkerCaseStart(
  connectionModel: ConnectionModel,
  scenarioLabel: string,
  mode: ExecutionMode,
  workerId?: string,
): void {
  const activity = getOrCreateWorkerActivity(connectionModel, scenarioLabel, mode, workerId ?? 'unknown');
  const startedAt = Date.now();
  if (activity.startMs === undefined || startedAt < activity.startMs) {
    activity.startMs = startedAt;
  }
}

function recordWorkerCaseCompletion(
  connectionModel: ConnectionModel,
  scenarioLabel: string,
  mode: ExecutionMode,
  workerId?: string,
): void {
  const activity = getOrCreateWorkerActivity(connectionModel, scenarioLabel, mode, workerId ?? 'unknown');
  const completedAt = Date.now();
  activity.endMs = activity.endMs === undefined ? completedAt : Math.max(activity.endMs, completedAt);
  activity.cases += 1;
}

function recordWorkerMigrationStatements(
  connectionModel: ConnectionModel,
  scenarioLabel: string,
  mode: ExecutionMode,
  workerId: string | undefined,
  count: number,
): void {
  if (count <= 0) {
    return;
  }
  const activity = getOrCreateWorkerActivity(connectionModel, scenarioLabel, mode, workerId ?? 'unknown');
  activity.migrationStatements += count;
}

function getWorkerActivities(): WorkerActivity[] {
  return Array.from(workerActivities.values());
}

function captureAndResetWorkerTimeRanges(runStartMs: number): WorkerTimeRange[] {
  const ranges = getWorkerActivities().map((activity) => ({
    workerId: activity.workerId,
    cases: activity.cases,
    startOffsetMs:
      activity.startMs !== undefined ? activity.startMs - runStartMs : undefined,
    endOffsetMs: activity.endMs !== undefined ? activity.endMs - runStartMs : undefined,
  }));
  workerActivities.clear();
  return ranges.sort((a, b) => a.workerId.localeCompare(b.workerId));
}

const DEFAULT_CONNECTION_MODEL: ConnectionModel = 'perWorker';
const DEFAULT_CONNECTION_MODELS: ConnectionModel[] = ['perWorker', 'caseLocal'];
const CONNECTION_MODEL_ALIASES: Record<string, ConnectionModel> = {
  perworker: 'perWorker',
  caselocal: 'caseLocal',
  shared: 'perWorker',
};

function normalizeConnectionModelKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/gu, '');
}

function parseConnectionModelToken(value: string, source: string): ConnectionModel {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`Empty connection model provided in ${source}`);
  }
  const normalized = normalizeConnectionModelKey(trimmed);
  const resolved = CONNECTION_MODEL_ALIASES[normalized];
  if (!resolved) {
    throw new Error(
      `Invalid connection model "${value}" for ${source}. Supported values: perWorker and caseLocal (aliases: shared, case-local, per-worker).`,
    );
  }
  return resolved;
}

function resolveLegacyConnectionModel(envVar: string): ConnectionModel | undefined {
  const value = process.env[envVar];
  if (!value) {
    return undefined;
  }
  return parseConnectionModelToken(value, envVar);
}

function resolveBenchConnectionModels(): ConnectionModel[] {
  const explicitSingle = process.env.BENCH_CONNECTION_MODEL
    ? parseConnectionModelToken(process.env.BENCH_CONNECTION_MODEL, 'BENCH_CONNECTION_MODEL')
    : undefined;
  const legacyZtd = resolveLegacyConnectionModel('ZTD_BENCH_CONNECTION_MODEL');
  const legacyTraditional = resolveLegacyConnectionModel('TRADITIONAL_BENCH_CONNECTION_MODEL');

  if (legacyZtd && legacyTraditional && legacyZtd !== legacyTraditional) {
    throw new Error(
      'ZTD_BENCH_CONNECTION_MODEL and TRADITIONAL_BENCH_CONNECTION_MODEL must agree; remove the legacy variables or ensure they match.',
    );
  }

  // Legacy variables must agree and can still seed the default connection model.
  const legacyModel = legacyZtd ?? legacyTraditional;
  if (explicitSingle && legacyModel && explicitSingle !== legacyModel) {
    throw new Error(
      'BENCH_CONNECTION_MODEL must match the legacy ZTD_BENCH_CONNECTION_MODEL/TRADITIONAL_BENCH_CONNECTION_MODEL values when supplied.',
    );
  }

  const multiRaw = process.env.BENCH_CONNECTION_MODELS;
  if (multiRaw && multiRaw.trim().length > 0) {
    // Multi-run mode enumerates each connection model we want to exercise sequentially.
    const tokens = multiRaw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const resolvedModels: ConnectionModel[] = [];
    const seen = new Set<ConnectionModel>();
    for (const token of tokens) {
      const model = parseConnectionModelToken(token, 'BENCH_CONNECTION_MODELS');
      if (!seen.has(model)) {
        resolvedModels.push(model);
        seen.add(model);
      }
    }
    if (resolvedModels.length === 0) {
      throw new Error('BENCH_CONNECTION_MODELS must include at least one connection model.');
    }
    if (explicitSingle && explicitSingle !== resolvedModels[0]) {
      throw new Error('BENCH_CONNECTION_MODEL must match the first entry of BENCH_CONNECTION_MODELS.');
    }
    if (legacyModel && !resolvedModels.includes(legacyModel)) {
      throw new Error(
        'Legacy connection model must appear in BENCH_CONNECTION_MODELS when legacy variables are set.',
      );
    }
    return resolvedModels;
  }

  const baseModel = explicitSingle ?? legacyModel;
  if (baseModel) {
    return [baseModel];
  }
  return DEFAULT_CONNECTION_MODELS;
}

let currentConnectionModel: ConnectionModel = DEFAULT_CONNECTION_MODEL;

function setActiveConnectionModel(model: ConnectionModel): void {
  currentConnectionModel = model;
}

function getActiveConnectionModel(): ConnectionModel {
  return currentConnectionModel;
}

function clearWorkerActivities(): void {
  workerActivities.clear();
}

type TraditionalAcquireOptions = {
  connectionModel: ConnectionModel;
  workerId?: string;
  mode: ExecutionMode;
  caseName: string;
  context?: BenchContext;
};

async function acquireTraditionalQueryable(options: TraditionalAcquireOptions): Promise<{
  queryable: (text: string, values?: unknown[]) => Promise<unknown>;
  pid: number;
  release: () => Promise<void>;
}> {
  // Resolve the per-case vs per-worker scope so the connection model stays explicit.
  const scope = options.connectionModel === 'perWorker' ? 'worker' : 'case';
  const connectionAppName = `ztd-bench-traditional-${options.mode}-${options.caseName}`;
  const { client, pid, release } = await getDbClient({
    scope,
    workerId: options.workerId,
    applicationName: connectionAppName,
  });
  // Wrap the raw client so the caller only needs a simple query helper.
  const queryable = (text: string, values?: unknown[]) => client.query(text, values);
  return { queryable, pid, release };
}

const METRICS_STATUS_LOG: MetricsStatusEntry[] = [];

const ROOT_DIR = path.resolve(__dirname, '..');
const TMP_DIR = path.join(ROOT_DIR, 'tmp', 'bench');
const REPORT_PATH = process.env.ZTD_BENCH_REPORT_PATH ?? path.join(TMP_DIR, 'report.md');
const TRADITIONAL_SQL_LOG_DIR = path.join(TMP_DIR, 'traditional-sql');
const BENCH_LOG_PATH =
  process.env.ZTD_BENCH_LOG_PATH ?? path.join(TMP_DIR, 'log.jsonl');
const CLI_LOG_LEVEL = process.argv.includes('--debug')
  ? 'debug'
  : process.argv.includes('--verbose')
    ? 'info'
    : undefined;
const REQUESTED_LOG_LEVEL = process.env.BENCH_LOG_LEVEL ?? CLI_LOG_LEVEL ?? 'quiet';

configureBenchmarkLogger({
  level: REQUESTED_LOG_LEVEL,
  logFilePath: BENCH_LOG_PATH,
});

const DIAGNOSTIC_MODE = process.env.ZTD_BENCH_DIAGNOSTIC === '1';
const BENCH_PROFILE = resolveBenchProfile();
const DEFAULT_SCENARIO_SELECTION: BenchScenarioSelection =
  BENCH_PROFILE.name === 'quick'
    ? {
        label: 'variable-only',
        includeRunner: false,
        includeSteady: false,
        includeLowerBound: true,
      }
    : {
        label: 'runner+steady',
        includeRunner: true,
        includeSteady: true,
        includeLowerBound: true,
      };
const BASE_BENCH_SCENARIOS = resolveBenchScenarios(DEFAULT_SCENARIO_SELECTION);
const BENCH_SCENARIOS: BenchScenarioSelection = DIAGNOSTIC_MODE
  ? {
      label: 'diag',
      includeRunner: false,
      includeSteady: false,
      includeLowerBound: true,
    }
  : BASE_BENCH_SCENARIOS;
const SUITE_MULTIPLIERS = DIAGNOSTIC_MODE
  ? [1]
  : resolveSuiteMultipliers(BENCH_PROFILE.defaults.suiteMultipliers);
const WARMUP_RUNS = DIAGNOSTIC_MODE
  ? 0
  : resolveNumberSetting(process.env.ZTD_BENCH_WARMUP, BENCH_PROFILE.defaults.warmupRuns, 0);
const MEASURED_RUNS = DIAGNOSTIC_MODE
  ? 1
  : resolveNumberSetting(process.env.ZTD_BENCH_RUNS, BENCH_PROFILE.defaults.measuredRuns, 1);
const MEASURED_RUNS_OVERRIDDEN = DIAGNOSTIC_MODE || process.env.ZTD_BENCH_RUNS !== undefined;
const PARALLEL_WORKER_COUNTS = resolveParallelWorkerCounts();
let activeParallelWorkers = PARALLEL_WORKER_COUNTS[0] ?? (DIAGNOSTIC_MODE ? 1 : 4);
const STEADY_STATE_ITERATIONS = resolveSteadyStateIterations(
  BENCH_PROFILE.defaults.steadyStateIterations,
);
const STEADY_STATE_SUITE_MULTIPLIER = resolveNumberSetting(
  process.env.STEADY_STATE_SUITE_MULTIPLIER,
  BENCH_PROFILE.defaults.steadyStateSuiteMultiplier,
  1,
);
const BENCH_CONNECTION_MODELS = resolveBenchConnectionModels();
setActiveConnectionModel(BENCH_CONNECTION_MODELS[0]);
const sharedConnectionLogger: ConnectionLogger = (entry) => {
  recordConnectionEvent(entry);
};
const RUNNER_WARMUP_RUNS = 0;
const RUNNER_MEASURED_RUNS = 1;
const STEADY_STATE_WARMUPS = 1;
const STEADY_STATE_MEASURED_RUNS = 3;

const TRADITIONAL_CASE_COUNT = TRADITIONAL_CASES.length;
const TRADITIONAL_SQL_LOGGED_CASES = new Set<string>();
const ZTD_CASE_RUNNERS = [
  { caseName: 'customer-summary', runner: runCustomerSummaryCase },
  { caseName: 'product-ranking', runner: runProductRankingCase },
  { caseName: 'sales-summary', runner: runSalesSummaryCase },
];

function createEmptyZtdMetrics(): ZtdBenchMetrics {
  return {
    sqlCount: 0,
    totalDbMs: 0,
    totalQueryMs: 0,
    rewriteMs: 0,
    fixtureMaterializationMs: 0,
    sqlGenerationMs: 0,
    otherProcessingMs: 0,
  };
}

function clearMetricsStatus(): void {
  METRICS_STATUS_LOG.length = 0;
}

function logMetricsStatus(entry: MetricsStatusEntry): void {
  METRICS_STATUS_LOG.push(entry);
}

function getMetricsStatusEntries(): MetricsStatusEntry[] {
  return [...METRICS_STATUS_LOG];
}

function ensureDirectories(): void {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
}

type RecordedStatement = {
  text: string;
  values?: unknown[];
};

function logTraditionalSqlStatements(caseName: string, statements: RecordedStatement[]): void {
  if (statements.length === 0 || TRADITIONAL_SQL_LOGGED_CASES.has(caseName)) {
    return;
  }
  TRADITIONAL_SQL_LOGGED_CASES.add(caseName);
  // Keep one example per case to avoid filling tmp/bench with duplicates.
  fs.mkdirSync(TRADITIONAL_SQL_LOG_DIR, { recursive: true });

  const lines: string[] = [];
  lines.push(`-- Traditional SQL log for ${caseName}`);
  statements.forEach((statement, index) => {
    lines.push(`-- Statement ${index + 1}`);
    lines.push(statement.text);
    if (statement.values && statement.values.length > 0) {
      lines.push(`-- params: ${JSON.stringify(statement.values)}`);
    }
  });

  const logPath = path.join(TRADITIONAL_SQL_LOG_DIR, `${caseName}.sql`);
  fs.writeFileSync(logPath, lines.join('\n\n'), 'utf8');
}

function platformCommand(command: string): string {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}

function quoteArg(arg: string): string {
  if (/[\s"]/u.test(arg)) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  return arg;
}

function formatMs(value: number): string {
  if (value < 1) {
    return value.toFixed(3);
  }
  return value.toFixed(2);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const avg = average(values);
  const variance = average(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  // Sort a copy so we can pick the middle element without mutating caller data.
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function computePercentile(values: number[], percentile: number): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const clamped = Math.min(1, Math.max(0, percentile));
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(clamped * sorted.length) - 1));
  return sorted[index];
}

function resolveBenchProfile(): BenchProfile {
  const raw = (process.env.BENCH_PROFILE ?? 'quick').toLowerCase().trim();
  if (raw === 'ci' || raw === 'full') {
    return {
      name: 'ci',
      defaults: {
        warmupRuns: 2,
        measuredRuns: 10,
        suiteMultipliers: [10, 20, 40, 80],
        steadyStateIterations: 10,
        steadyStateSuiteMultiplier: 50,
      },
    };
  }
  if (raw === 'dev') {
    return {
      name: 'dev',
      defaults: {
        warmupRuns: 1,
        measuredRuns: 10,
        suiteMultipliers: [10, 20, 40, 80],
        steadyStateIterations: 5,
        steadyStateSuiteMultiplier: 10,
      },
    };
  }
  return {
    name: 'quick',
    defaults: {
      warmupRuns: 1,
      measuredRuns: 3,
      suiteMultipliers: [10, 20, 40, 80],
      steadyStateIterations: 3,
      steadyStateSuiteMultiplier: 10,
    },
  };
}

function resolveBenchScenarios(defaultSelection: BenchScenarioSelection): BenchScenarioSelection {
  const raw = process.env.BENCH_SCENARIOS?.toLowerCase().trim();
  if (raw === 'runner') {
    return {
      label: 'runner',
      includeRunner: true,
      includeSteady: false,
      includeLowerBound: false,
    };
  }
  if (raw === 'steady') {
    return {
      label: 'steady',
      includeRunner: false,
      includeSteady: true,
      includeLowerBound: false,
    };
  }
  if (raw === 'all') {
    return {
      label: 'all',
      includeRunner: true,
      includeSteady: true,
      includeLowerBound: true,
    };
  }

  return defaultSelection;
}

function resolveNumberSetting(value: string | undefined, fallback: number, min: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return Math.floor(parsed);
}

function resolveSuiteMultipliers(defaults: number[]): number[] {
  const raw = process.env.SUITE_MULTIPLIERS;
  const values = (raw ?? defaults.join(','))
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));
  // Ensure at least one multiplier so the benchmark always has output.
  return values.length > 0 ? values : defaults.length > 0 ? defaults : [1];
}

function resolveSteadyStateIterations(defaultValue: number): number {
  const raw = Number(process.env.ITERATIONS ?? defaultValue);
  if (!Number.isFinite(raw) || raw < 1) {
    return defaultValue;
  }
  return Math.floor(raw);
}

function normalizeWorkerCounts(raw: string): number[] {
  return raw
    .split(',')
    .map((entry) => Number(entry.trim()))
    .map((value) => Math.floor(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce<number[]>((acc, value) => {
      if (!acc.includes(value)) {
        acc.push(value);
      }
      return acc;
    }, []);
}

function resolveParallelWorkerCounts(): number[] {
  if (DIAGNOSTIC_MODE) {
    return [1];
  }
  const explicitList = process.env.BENCH_PARALLEL_WORKER_COUNTS;
  if (explicitList && explicitList.trim().length > 0) {
    const parsed = normalizeWorkerCounts(explicitList);
    if (parsed.length > 0) {
      return parsed;
    }
  }
  const legacyWorkers = Number(process.env.ZTD_BENCH_WORKERS ?? '');
  if (Number.isFinite(legacyWorkers) && legacyWorkers > 0) {
    return [Math.floor(legacyWorkers)];
  }
  return [4, 8];
}

function setActiveParallelWorkers(count: number): void {
  activeParallelWorkers = count;
}

function getActiveParallelWorkers(): number {
  return activeParallelWorkers;
}

function annotateParallelWorkerCount(runMetrics: RunMetrics, mode: ExecutionMode): void {
  runMetrics.parallelWorkerCount = mode === 'parallel' ? getActiveParallelWorkers() : 1;
}


function shouldWarmupMultiplier(multiplier: number, baselineMultiplier: number): boolean {
  return multiplier === baselineMultiplier && WARMUP_RUNS > 0;
}

function resolveMeasuredRunsForMultiplier(multiplier: number): number {
  return MEASURED_RUNS;
}

function resolveLowerBoundMeasuredRuns(): number {
  if (MEASURED_RUNS_OVERRIDDEN || BENCH_PROFILE.name !== 'dev') {
    return MEASURED_RUNS;
  }
  return 1;
}

function formatRunPlan(
  suiteMultipliers: number[],
  baselineMultiplier: number,
  measuredRunsByMultiplier: (multiplier: number) => number,
): string {
  return suiteMultipliers
    .map((multiplier) => {
      const warmups = shouldWarmupMultiplier(multiplier, baselineMultiplier) ? WARMUP_RUNS : 0;
      const measured = measuredRunsByMultiplier(multiplier);
      const suiteSize = TRADITIONAL_CASE_COUNT * multiplier;
      return `${suiteSize} tests: ${warmups} warmup / ${measured} measured`;
    })
    .join('; ');
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  const commandLine = [command, ...args].map(quoteArg).join(' ');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(commandLine, {
      cwd: ROOT_DIR,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const message = [
        `Command failed: ${command} ${args.join(' ')}`,
        stdout.trim(),
        stderr.trim(),
      ]
        .filter((line) => line.length > 0)
        .join('\n');
      reject(new Error(message));
    });
  });
}

async function runZtdRunnerSuite(
  mode: ExecutionMode,
  runIndex: number,
  databaseUrl: string,
  suiteMultiplier: number,
  phase: RunPhase,
): Promise<RunMetrics> {
  const pnpm = platformCommand('pnpm');
  const parallelWorkerCount = getActiveParallelWorkers();
  const metricsPrefix = path.join(
    TMP_DIR,
    `ztd-runner-${phase}-${mode}-${suiteMultiplier}-${runIndex}-${parallelWorkerCount}`,
  );
  const metricsPath = `${metricsPrefix}.json`;
  const suiteSize = TRADITIONAL_CASE_COUNT * suiteMultiplier;

  clearMetricsFiles(metricsPrefix);
  // Run the dedicated runner-only test suite so pnpm+vitest startup and execution can be measured separately.
  const args = [
    'exec',
    'vitest',
    'run',
    '--config',
    'benchmarks/ztd-bench/vitest.config.ts',
    '--reporter=dot',
    'benchmarks/ztd-bench/tests/runner/runner-overhead.test.ts',
  ];

  if (mode === 'serial') {
    args.push('--maxWorkers=1', '--no-file-parallelism');
  } else {
    args.push(`--maxWorkers=${getActiveParallelWorkers()}`);
  }

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    ZTD_BENCH_METRICS_PREFIX: metricsPrefix,
    SUITE_MULTIPLIER: suiteMultiplier.toString(),
  };

  const start = process.hrtime.bigint();
  await runCommand(pnpm, args, env);
  const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

  const executionMs = readExecutionMetrics(metricsPrefix);
  const startupMs =
    typeof executionMs === 'number' ? Math.max(0, durationMs - executionMs) : undefined;
  const perTestMs = suiteSize > 0 ? durationMs / suiteSize : undefined;
  const startupShare =
    typeof startupMs === 'number' && durationMs > 0 ? startupMs / durationMs : undefined;
  const executionShare =
    typeof executionMs === 'number' && durationMs > 0 ? executionMs / durationMs : undefined;

  const runMetrics: RunMetrics = {
    scenario: 'ztd-runner',
    phase,
    mode,
    durationMs,
    suiteMultiplier,
    suiteSize,
    perTestMs,
    startupMs,
    executionMs,
    startupShare,
    executionShare,
  };

  const usedFiles = [metricsPath];
  const missingFiles: string[] = [];
  const executionPath = `${metricsPrefix}-execution.json`;
  if (typeof executionMs === 'number') {
    usedFiles.push(executionPath);
  } else {
    missingFiles.push('execution file');
  }

  recordMetricsStatus(
    'ztd-runner',
    mode,
    suiteMultiplier,
    phase,
    runIndex,
    usedFiles,
    missingFiles,
  );

  annotateParallelWorkerCount(runMetrics, mode);
  fs.writeFileSync(metricsPath, JSON.stringify(runMetrics, null, 2), 'utf8');
  return {
    ...runMetrics,
  };
}

async function runZtdInProcessSuite(
  mode: ExecutionMode,
  runIndex: number,
  databaseUrl: string,
  suiteMultiplier: number,
  phase: RunPhase,
): Promise<RunMetrics> {
  const start = process.hrtime.bigint();
  // Track pg_stat_activity while the in-process suite runs so we can report actual concurrency.
  const sampler = new SessionSampler();
  await sampler.start();
  const suiteSize = TRADITIONAL_CASE_COUNT * suiteMultiplier;
  const parallelWorkerCount = getActiveParallelWorkers();
  const metricsPrefix = path.join(
    TMP_DIR,
    `ztd-in-process-${phase}-${mode}-${suiteMultiplier}-${runIndex}-${parallelWorkerCount}`,
  );
  const metricsPath = `${metricsPrefix}.json`;

  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  const perWorkerConnections = getActiveConnectionModel() === 'perWorker';
  const sessionWorkerCount =
    perWorkerConnections && mode === 'parallel'
      ? Math.max(1, getActiveParallelWorkers())
      : 1;
  const workerSlots = perWorkerConnections ? sessionWorkerCount : 1;
  const workerTokens = new Set<string>();
  try {
    clearMetricsFiles(metricsPrefix);

    // Accumulate metrics from every repository-level case run.
    const aggregated = createEmptyZtdMetrics();
    const metricsCollector = (metrics: ZtdBenchMetrics) => {
      aggregated.sqlCount += metrics.sqlCount;
      aggregated.totalDbMs += metrics.totalDbMs;
      aggregated.totalQueryMs += metrics.totalQueryMs;
      aggregated.rewriteMs += metrics.rewriteMs;
      aggregated.fixtureMaterializationMs += metrics.fixtureMaterializationMs;
      aggregated.sqlGenerationMs += metrics.sqlGenerationMs;
      aggregated.otherProcessingMs += metrics.otherProcessingMs;
    };

    const runCase = async (
      caseIndex: number,
      repetition: number,
      workerId: string,
    ): Promise<void> => {
      const caseDef = ZTD_CASE_RUNNERS[caseIndex];
      const schemaName = buildBenchSchemaName(
        caseDef.caseName,
        `${phase}_${mode}_${runIndex}_${repetition}_${caseIndex}`,
      );
      const scenarioLabel = 'ztd-in-process';
      recordWorkerCaseStart(getActiveConnectionModel(), scenarioLabel, mode, workerId);
      try {
        await caseDef.runner({
          schemaName,
          metricsCollector,
          connectionModel: getActiveConnectionModel(),
          connectionLogger: sharedConnectionLogger,
          scenarioLabel,
          mode,
          workerId,
          caseName: caseDef.caseName,
          suiteMultiplier,
          runIndex,
          phase,
          parallelWorkerCount: sessionWorkerCount,
        });
      } finally {
        recordWorkerCaseCompletion(getActiveConnectionModel(), scenarioLabel, mode, workerId);
      }
    };

    const buildWorkerId = (
      repetition: number,
      caseIndex: number,
      explicitSlot?: number,
    ): string => {
      if (!perWorkerConnections) {
        return `${mode}-${runIndex}-${repetition}-${caseIndex}`;
      }
      const slot =
        explicitSlot !== undefined
          ? explicitSlot
          : mode === 'serial'
            ? 0
            : (repetition * ZTD_CASE_RUNNERS.length + caseIndex) % workerSlots;
      const token = `${mode}-${runIndex}-worker-${slot}`;
      workerTokens.add(token);
      return token;
    };

    // Choose serial or parallel execution to match the requested mode.
    if (mode === 'serial') {
      for (let repetition = 0; repetition < suiteMultiplier; repetition += 1) {
        for (let caseIndex = 0; caseIndex < ZTD_CASE_RUNNERS.length; caseIndex += 1) {
          const workerId = buildWorkerId(repetition, caseIndex);
          await runCase(caseIndex, repetition, workerId);
        }
      }
    } else {
      if (!perWorkerConnections) {
        const tasks: Promise<void>[] = [];
        for (let repetition = 0; repetition < suiteMultiplier; repetition += 1) {
          for (let caseIndex = 0; caseIndex < ZTD_CASE_RUNNERS.length; caseIndex += 1) {
            const workerId = buildWorkerId(repetition, caseIndex);
            tasks.push(runCase(caseIndex, repetition, workerId));
          }
        }
        await Promise.all(tasks);
      } else {
        const slotWorkers = Array.from({ length: workerSlots }, (_, slot) => slot);
        await Promise.all(
          slotWorkers.map(async (slot) => {
            for (let repetition = 0; repetition < suiteMultiplier; repetition += 1) {
              for (let caseIndex = 0; caseIndex < ZTD_CASE_RUNNERS.length; caseIndex += 1) {
                const casePosition = repetition * ZTD_CASE_RUNNERS.length + caseIndex;
                if (casePosition % workerSlots !== slot) {
                  continue;
                }
                const workerId = buildWorkerId(repetition, caseIndex, slot);
                await runCase(caseIndex, repetition, workerId);
              }
            }
          }),
        );
      }
    }

    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const perTestMs = suiteSize > 0 ? durationMs / suiteSize : undefined;

    const runMetrics: RunMetrics = {
      scenario: 'ztd-in-process',
      phase,
      mode,
      durationMs,
      suiteMultiplier,
      suiteSize,
      perTestMs,
      sqlCount: aggregated.sqlCount,
      totalDbMs: aggregated.totalDbMs,
      totalQueryMs: aggregated.totalQueryMs,
      rewriteMs: aggregated.rewriteMs,
      fixtureMaterializationMs: aggregated.fixtureMaterializationMs,
      sqlGenerationMs: aggregated.sqlGenerationMs,
      otherProcessingMs: aggregated.otherProcessingMs,
    };

    recordMetricsStatus(
      'ztd-in-process',
      mode,
      suiteMultiplier,
      phase,
      runIndex,
      [metricsPath],
      [],
    );

    annotateParallelWorkerCount(runMetrics, mode);
    fs.writeFileSync(metricsPath, JSON.stringify(runMetrics, null, 2), 'utf8');
    return runMetrics;
  } finally {
    currentTraditionalDiagnostic = null;
    const sessionSummary = await safeStopSampler(sampler);
    recordZtdSession(
      {
        scenario: 'ztd-in-process',
        connectionModel: getActiveConnectionModel(),
        mode,
        phase,
        suiteMultiplier,
        workerCount: sessionWorkerCount,
      },
      sessionSummary.maxActive,
    );
    recordSessionStat({
      scenarioLabel: 'ztd-in-process',
      mode,
      phase,
      suiteMultiplier,
      runIndex,
      maxTotalSessions: sessionSummary.maxTotal,
      maxActiveSessions: sessionSummary.maxActive,
      sampleCount: sessionSummary.sampleCount,
    });
    if (perWorkerConnections && workerTokens.size > 0) {
      await Promise.all([...workerTokens].map((token) => releaseWorkerClient(token)));
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
}

async function runMigrationCase(
  mode: ExecutionMode,
  runIndex: number,
  caseIndex: number,
  caseName: string,
  sql: string,
  context: {
    scenarioLabel: string;
    phase: RunPhase;
    suiteMultiplier: number;
    workerId?: string;
    connectionModel: ConnectionModel;
    workerSlot?: number;
  },
): Promise<{ statements: number; totalDbMs: number }> {
  const connectionModel = context.connectionModel;
  const benchContext: BenchContext = {
    scenario: context.scenarioLabel,
    mode,
    phase: context.phase,
    suiteMultiplier: context.suiteMultiplier,
    runIndex,
    caseName,
    workerId: context.workerId,
    approach: 'traditional',
  };
  const workerId = context.workerId;
  recordWorkerCaseStart(connectionModel, context.scenarioLabel, mode, workerId);
  const { queryable, pid, release } = await acquireTraditionalQueryable({
    connectionModel,
    workerId: context.workerId,
    mode,
    caseName,
    context: benchContext,
  });
  const diagnostic = currentTraditionalDiagnostic;
  if (diagnostic) {
    const workerKey = workerId ?? 'unknown';
    diagnostic.casesPerWorker.set(
      workerKey,
      (diagnostic.casesPerWorker.get(workerKey) ?? 0) + 1,
    );
    diagnostic.activeConnections += 1;
    diagnostic.peakConnections = Math.max(diagnostic.peakConnections, diagnostic.activeConnections);
  }
  // Record which backend PID handled this case so we can prove serialization vs parallelism.
  recordConnectionEvent({
    scenarioLabel: context.scenarioLabel,
    mode,
    phase: context.phase,
    suiteMultiplier: context.suiteMultiplier,
    runIndex,
    workerId: context.workerId,
    caseName,
    pid,
    connectionModel,
  });

  let statements = 0;
  let totalDbMs = 0;
  let dbExecutionStarted = false;
  const recordedStatements: RecordedStatement[] = [];
  let migrationStatements = 0;

  const execute = async (
    text: string,
    values?: unknown[],
    options?: { isRepositoryQuery?: boolean },
  ) => {
    if (!dbExecutionStarted) {
      dbExecutionStarted = true;
      logBenchPhase('db-execution', 'start', benchContext);
    }
    const start = process.hrtime.bigint();
    statements += 1;
    if (!options?.isRepositoryQuery) {
      migrationStatements += 1;
    }
    recordedStatements.push({
      text: text.trim(),
      values: values && values.length > 0 ? values.slice() : undefined,
    });
    await queryable(text, values);
    totalDbMs += Number(process.hrtime.bigint() - start) / 1_000_000;
  };

  const schemaName = `bench_${mode}_${runIndex}_${caseIndex}`;
  const migrationStart = process.hrtime.bigint();
  logBenchPhase('migration', 'start', benchContext);
  try {
    await execute(`CREATE SCHEMA "${schemaName}"`);
    await execute(`SET search_path TO "${schemaName}"`);

    // Create tables in the temporary schema to mirror migration-style workflows.
    await execute(`
      CREATE TABLE customer (
        customer_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        customer_name text NOT NULL,
        customer_email text NOT NULL,
        registered_at timestamp NOT NULL
      );
    `);

    await execute(`
      CREATE TABLE product (
        product_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        product_name text NOT NULL,
        list_price numeric NOT NULL,
        product_category_id bigint
      );
    `);

    await execute(`
      CREATE TABLE sales_order (
        sales_order_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        customer_id bigint NOT NULL REFERENCES customer (customer_id),
        sales_order_date date NOT NULL,
        sales_order_status_code int NOT NULL
      );
    `);

    await execute(`
      CREATE TABLE sales_order_item (
        sales_order_item_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        sales_order_id bigint NOT NULL REFERENCES sales_order (sales_order_id),
        product_id bigint NOT NULL REFERENCES product (product_id),
        quantity int NOT NULL,
        unit_price numeric NOT NULL
      );
    `);

    await insertRows(
      execute,
      'customer',
      ['customer_id', 'customer_name', 'customer_email', 'registered_at'],
      CUSTOMER_ROWS,
    );
    await insertRows(
      execute,
      'product',
      ['product_id', 'product_name', 'list_price', 'product_category_id'],
      PRODUCT_ROWS,
    );
    await insertRows(
      execute,
      'sales_order',
      ['sales_order_id', 'customer_id', 'sales_order_date', 'sales_order_status_code'],
      SALES_ORDER_ROWS,
    );
    await insertRows(
      execute,
      'sales_order_item',
      ['sales_order_item_id', 'sales_order_id', 'product_id', 'quantity', 'unit_price'],
      SALES_ORDER_ITEM_ROWS,
    );

    await execute(sql, undefined, { isRepositoryQuery: true });
  } finally {
    const migrationDurationMs = Number(process.hrtime.bigint() - migrationStart) / 1_000_000;
    logBenchPhase('migration', 'end', benchContext, {
      durationMs: migrationDurationMs,
    });
    try {
      await execute(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      const releaseStart = process.hrtime.bigint();
      logBenchPhase('releaseClient', 'start', benchContext);
      try {
        if (diagnostic) {
          diagnostic.activeConnections = Math.max(0, diagnostic.activeConnections - 1);
        }
        await release();
      } finally {
        const cleanupMs = Number(process.hrtime.bigint() - releaseStart) / 1_000_000;
        logBenchPhase('releaseClient', 'end', benchContext, {
          cleanupMs,
        });
      }
    }
  }

  logTraditionalSqlStatements(caseName, recordedStatements);
  logBenchPhase('db-execution', 'end', benchContext, {
    dbMs: totalDbMs,
    statements,
  });
  recordWorkerCaseCompletion(connectionModel, context.scenarioLabel, mode, workerId);
  recordWorkerMigrationStatements(
    connectionModel,
    context.scenarioLabel,
    mode,
    workerId,
    migrationStatements,
  );
  return { totalDbMs, statements };
}

async function runTraditionalSuiteLowerBound(
  mode: ExecutionMode,
  runIndex: number,
  databaseUrl: string,
  suiteMultiplier: number,
  phase: RunPhase,
): Promise<RunMetrics> {
  const start = process.hrtime.bigint();
  const runStartMs = Date.now();
  const sampler = new SessionSampler();
  await sampler.start();
  const suiteSize = TRADITIONAL_CASE_COUNT * suiteMultiplier;
  const parallelWorkerCount = getActiveParallelWorkers();
  const validationKey = `${getActiveConnectionModel()}:${suiteMultiplier}:${mode}:${phase}:${parallelWorkerCount}`;
  const shouldCaptureValidation =
    mode === 'parallel' && phase === 'measured' && !parallelValidationTokens.has(validationKey);
  if (shouldCaptureValidation) {
    const validationWorkerCount = Math.max(1, parallelWorkerCount);
    const summary = await runTraditionalParallelismValidation({
      workerCount: validationWorkerCount,
    });
    const uniquePids = new Set(summary.workerPids.values());
    if (summary.maxActiveSessions < summary.workerCount) {
      throw new Error(
        `Traditional parallelism validation only observed ${summary.maxActiveSessions} active sessions for ${summary.workerCount} workers.`,
      );
    }
    if (uniquePids.size < summary.workerCount) {
      throw new Error(
        `Traditional parallelism validation only captured ${uniquePids.size} unique pg_backend_pid values for ${summary.workerCount} workers.`,
      );
    }
    parallelValidationTokens.add(validationKey);
  }
  const metricsPath = path.join(
    TMP_DIR,
    `traditional-in-process-${phase}-${mode}-${suiteMultiplier}-${runIndex}-${parallelWorkerCount}.json`,
  );
  const workerToken = `${mode}-${runIndex}`;
  const diagnostic: TraditionalParallelDiagnostic = {
    casesPerWorker: new Map<string, number>(),
    activeConnections: 0,
    peakConnections: 0,
  };
  currentTraditionalDiagnostic = diagnostic;
  try {
    void databaseUrl;
    const runWorkerId = (caseIndex: number, repetition: number) =>
      `${mode}-${runIndex}-${repetition}-${caseIndex}`;
    const resolveWorkerId = (
      caseIndex: number,
      repetition: number,
      override?: string,
    ) =>
      override ??
      (getActiveConnectionModel() === 'perWorker'
        ? workerToken
        : runWorkerId(caseIndex, repetition));
    const buildCaseContext = (
      caseIndex: number,
      repetition: number,
      workerIdOverride?: string,
    ) => {
      return {
        scenarioLabel: 'traditional-in-process',
        phase,
        suiteMultiplier,
        workerId: resolveWorkerId(caseIndex, repetition, workerIdOverride),
        connectionModel: getActiveConnectionModel(),
      };
    };

    clearWorkerActivities();

    let aggregatedStatements = 0;
    let aggregatedDbMs = 0;

    if (mode === 'serial') {
      let statements = 0;
      let totalDbMs = 0;
      for (let repetition = 0; repetition < suiteMultiplier; repetition += 1) {
        for (let caseIndex = 0; caseIndex < TRADITIONAL_CASES.length; caseIndex += 1) {
          const migrationCase = TRADITIONAL_CASES[caseIndex];
          const result = await runMigrationCase(
            mode,
            runIndex,
            caseIndex + repetition * TRADITIONAL_CASES.length,
            migrationCase.name,
            migrationCase.sql,
            buildCaseContext(caseIndex, repetition),
          );
          statements += result.statements;
          totalDbMs += result.totalDbMs;
        }
      }
      aggregatedStatements = statements;
      aggregatedDbMs = totalDbMs;
    } else {
      const totalCases = TRADITIONAL_CASE_COUNT * suiteMultiplier;
      const effectiveWorkerCount = Math.max(1, parallelWorkerCount);
      const caseIndices = Array.from({ length: totalCases }, (_, index) => index);
      const chunkSize =
        totalCases > 0 ? Math.ceil(totalCases / effectiveWorkerCount) : 0;
      const workerChunks = Array.from({ length: effectiveWorkerCount }, (_, workerIdx) =>
        chunkSize > 0
          ? caseIndices.slice(
              workerIdx * chunkSize,
              Math.min(totalCases, (workerIdx + 1) * chunkSize),
            )
          : [],
      );

      const workerResults = await Promise.all(
        workerChunks.map((assignedCases, workerIdx) =>
          (async () => {
            let workerStatements = 0;
            let workerDbMs = 0;
            const workerId = `${mode}-${runIndex}-worker-${workerIdx}`;
            for (const globalCaseIndex of assignedCases) {
              const repetition = Math.floor(globalCaseIndex / TRADITIONAL_CASES.length);
              const caseIndex = globalCaseIndex % TRADITIONAL_CASES.length;
              const migrationCase = TRADITIONAL_CASES[caseIndex];
              const result = await runMigrationCase(
                mode,
                runIndex,
                globalCaseIndex,
                migrationCase.name,
                migrationCase.sql,
                buildCaseContext(caseIndex, repetition, workerId),
              );
              workerStatements += result.statements;
              workerDbMs += result.totalDbMs;
            }
            return { workerStatements, workerDbMs };
          })(),
        ),
      );

      aggregatedStatements = workerResults.reduce(
        (sum, value) => sum + value.workerStatements,
        0,
      );
      aggregatedDbMs = workerResults.reduce((sum, value) => sum + value.workerDbMs, 0);
    }

    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const casesPerWorkerRecord = Object.fromEntries(diagnostic.casesPerWorker);
    const workerTimeRanges = captureAndResetWorkerTimeRanges(runStartMs);
    const runMetrics: RunMetrics = {
      scenario: 'traditional-in-process',
      phase,
      mode,
      durationMs,
      suiteMultiplier,
      suiteSize,
      sqlCount: aggregatedStatements,
      totalDbMs: aggregatedDbMs,
      traditionalPeakConnections: shouldCaptureValidation ? diagnostic.peakConnections : undefined,
      traditionalCasesPerWorker: shouldCaptureValidation ? casesPerWorkerRecord : undefined,
      traditionalWorkerTimeRanges: shouldCaptureValidation ? workerTimeRanges : undefined,
    };
    annotateParallelWorkerCount(runMetrics, mode);
    fs.writeFileSync(metricsPath, JSON.stringify(runMetrics, null, 2), 'utf8');
    return runMetrics;
  } finally {
    const sessionSummary = await safeStopSampler(sampler);
    recordSessionStat({
      scenarioLabel: 'traditional-in-process',
      mode,
      phase,
      suiteMultiplier,
      runIndex,
      maxTotalSessions: sessionSummary.maxTotal,
      maxActiveSessions: sessionSummary.maxActive,
      sampleCount: sessionSummary.sampleCount,
    });
    currentTraditionalDiagnostic = null;
  }
}


async function runTraditionalSuiteViaRunner(
  mode: ExecutionMode,
  runIndex: number,
  databaseUrl: string,
  suiteMultiplier: number,
  phase: RunPhase,
): Promise<RunMetrics> {
  const pnpm = platformCommand('pnpm');
  const parallelWorkerCount = getActiveParallelWorkers();
  const metricsPrefix = path.join(
    TMP_DIR,
    `traditional-${phase}-${mode}-${suiteMultiplier}-${runIndex}-${parallelWorkerCount}`,
  );
  const suiteSize = TRADITIONAL_CASE_COUNT * suiteMultiplier;
  const metricsPath = `${metricsPrefix}-summary.json`;

  clearMetricsFiles(metricsPrefix);

  const args = [
    'exec',
    'vitest',
    'run',
    '--config',
    'benchmarks/ztd-bench/vitest.config.ts',
    '--reporter=dot',
    'benchmarks/ztd-bench/tests',
  ];

  if (mode === 'serial') {
    // Force a single worker and disable file-level parallelism for serial runs.
    args.push('--maxWorkers=1', '--no-file-parallelism');
  } else {
    args.push(`--maxWorkers=${getActiveParallelWorkers()}`);
  }

  const env = {
    ...process.env,
    BENCH_SUITE: 'traditional',
    DATABASE_URL: databaseUrl,
    TRADITIONAL_BENCH_METRICS_PREFIX: metricsPrefix,
    TRADITIONAL_BENCH_MODE: mode,
    TRADITIONAL_BENCH_RUN_INDEX: runIndex.toString(),
    SUITE_MULTIPLIER: suiteMultiplier.toString(),
    ZTD_BENCH_METRICS_PREFIX: metricsPrefix,
    BENCH_CONNECTION_MODEL: getActiveConnectionModel(),
  };

  const start = process.hrtime.bigint();
  await runCommand(pnpm, args, env);
  const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

  const aggregation = aggregateTraditionalMetrics(metricsPrefix, mode);
  const executionMs = readExecutionMetrics(metricsPrefix);
  const startupMs =
    typeof executionMs === 'number' ? Math.max(0, durationMs - executionMs) : undefined;
  const perTestMs = suiteSize > 0 ? durationMs / suiteSize : undefined;
  const startupShare =
    typeof startupMs === 'number' && durationMs > 0 ? startupMs / durationMs : undefined;
  const executionShare =
    typeof executionMs === 'number' && durationMs > 0 ? executionMs / durationMs : undefined;

  const runMetrics: RunMetrics = {
    scenario: 'traditional-runner',
    phase,
    mode,
    durationMs,
    suiteMultiplier,
    suiteSize,
    perTestMs,
    startupMs,
    executionMs,
    startupShare,
    executionShare,
    ...aggregation.metrics,
  };

  const executionPath = `${metricsPrefix}-execution.json`;
  const runMissingFiles = [...aggregation.missingFiles];
  const runUsedFiles = [...aggregation.usedFiles];
  if (typeof executionMs === 'number') {
    runUsedFiles.push(executionPath);
  } else {
    runMissingFiles.push('execution file');
  }

  recordMetricsStatus(
    'traditional-runner',
    mode,
    suiteMultiplier,
    phase,
    runIndex,
    runUsedFiles,
    runMissingFiles,
  );

  annotateParallelWorkerCount(runMetrics, mode);
  fs.writeFileSync(metricsPath, JSON.stringify(runMetrics, null, 2), 'utf8');
  return {
    ...runMetrics,
  };
}

async function runZtdSteadyStateSuite(
  mode: ExecutionMode,
  runIndex: number,
  databaseUrl: string,
  suiteMultiplier: number,
  phase: RunPhase,
): Promise<RunMetrics> {
  const pnpm = platformCommand('pnpm');
  const parallelWorkerCount = getActiveParallelWorkers();
  const metricsPrefix = path.join(
    TMP_DIR,
    `ztd-steady-${phase}-${mode}-${suiteMultiplier}-${runIndex}-${parallelWorkerCount}`,
  );
  const metricsPath = `${metricsPrefix}.json`;
  const suiteSize = TRADITIONAL_CASE_COUNT * suiteMultiplier;

  clearMetricsFiles(metricsPrefix);
  const args = [
    'exec',
    'vitest',
    'run',
    '--config',
      'benchmarks/ztd-bench/vitest.config.ts',
    '--reporter=dot',
  ];

  if (mode === 'serial') {
    // Force a single worker and disable file-level parallelism for serial runs.
    args.push('--maxWorkers=1', '--no-file-parallelism');
  } else {
    args.push(`--maxWorkers=${getActiveParallelWorkers()}`);
  }

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    ZTD_BENCH_METRICS_PREFIX: metricsPrefix,
    BENCH_STEADY_STATE: '1',
    ITERATIONS: STEADY_STATE_ITERATIONS.toString(),
    SUITE_MULTIPLIER: suiteMultiplier.toString(),
  };

  const start = process.hrtime.bigint();
  await runCommand(pnpm, args, env);
  const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

  const steadyState = readSteadyStateMetrics(metricsPrefix);
  const executionMs = readExecutionMetrics(metricsPrefix);
  const startupMs =
    typeof executionMs === 'number' ? Math.max(0, durationMs - executionMs) : undefined;
  const perTestMs = suiteSize > 0 ? durationMs / suiteSize : undefined;
  const startupShare =
    typeof startupMs === 'number' && durationMs > 0 ? startupMs / durationMs : undefined;
  const executionShare =
    typeof executionMs === 'number' && durationMs > 0 ? executionMs / durationMs : undefined;

  const runMetrics: RunMetrics = {
    scenario: 'ztd-steady-state',
    phase,
    mode,
    durationMs,
    suiteMultiplier,
    suiteSize,
    perTestMs,
    startupMs,
    executionMs,
    startupShare,
    executionShare,
    steadyState,
  };

  annotateParallelWorkerCount(runMetrics, mode);
  fs.writeFileSync(metricsPath, JSON.stringify(runMetrics, null, 2), 'utf8');
  return runMetrics;
}

async function runTraditionalSteadyStateSuite(
  mode: ExecutionMode,
  runIndex: number,
  databaseUrl: string,
  suiteMultiplier: number,
  phase: RunPhase,
): Promise<RunMetrics> {
  const pnpm = platformCommand('pnpm');
  const parallelWorkerCount = getActiveParallelWorkers();
  const metricsPrefix = path.join(
    TMP_DIR,
    `traditional-steady-${phase}-${mode}-${suiteMultiplier}-${runIndex}-${parallelWorkerCount}`,
  );
  const metricsPath = `${metricsPrefix}.json`;
  const suiteSize = TRADITIONAL_CASE_COUNT * suiteMultiplier;

  clearMetricsFiles(metricsPrefix);
  const args = [
    'exec',
    'vitest',
    'run',
    '--config',
    'benchmarks/ztd-bench/vitest.config.ts',
    '--reporter=dot',
    'benchmarks/ztd-bench/tests',
  ];

  if (mode === 'serial') {
    // Force a single worker and disable file-level parallelism for serial runs.
    args.push('--maxWorkers=1', '--no-file-parallelism');
  } else {
    args.push(`--maxWorkers=${getActiveParallelWorkers()}`);
  }

  const env = {
    ...process.env,
    BENCH_SUITE: 'traditional',
    DATABASE_URL: databaseUrl,
    TRADITIONAL_BENCH_METRICS_PREFIX: metricsPrefix,
    TRADITIONAL_BENCH_MODE: mode,
    TRADITIONAL_BENCH_RUN_INDEX: runIndex.toString(),
    BENCH_STEADY_STATE: '1',
    ITERATIONS: STEADY_STATE_ITERATIONS.toString(),
    SUITE_MULTIPLIER: suiteMultiplier.toString(),
    ZTD_BENCH_METRICS_PREFIX: metricsPrefix,
    BENCH_CONNECTION_MODEL: getActiveConnectionModel(),
  };

  const start = process.hrtime.bigint();
  await runCommand(pnpm, args, env);
  const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

  const steadyState = readSteadyStateMetrics(metricsPrefix);
  const executionMs = readExecutionMetrics(metricsPrefix);
  const startupMs =
    typeof executionMs === 'number' ? Math.max(0, durationMs - executionMs) : undefined;
  const perTestMs = suiteSize > 0 ? durationMs / suiteSize : undefined;
  const startupShare =
    typeof startupMs === 'number' && durationMs > 0 ? startupMs / durationMs : undefined;
  const executionShare =
    typeof executionMs === 'number' && durationMs > 0 ? executionMs / durationMs : undefined;

  const runMetrics: RunMetrics = {
    scenario: 'traditional-steady-state',
    phase,
    mode,
    durationMs,
    suiteMultiplier,
    suiteSize,
    perTestMs,
    startupMs,
    executionMs,
    startupShare,
    executionShare,
    steadyState,
  };

  annotateParallelWorkerCount(runMetrics, mode);
  fs.writeFileSync(metricsPath, JSON.stringify(runMetrics, null, 2), 'utf8');
  return runMetrics;
}

async function insertRows(
  execute: (text: string, values?: unknown[]) => Promise<void>,
  tableName: string,
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const values: unknown[] = [];
  const placeholders = rows.map((row) => {
    const rowPlaceholders = columns.map((column) => {
      values.push(row[column]);
      return `$${values.length}`;
    });
    return `(${rowPlaceholders.join(', ')})`;
  });

  await execute(
    `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders.join(', ')};`,
    values,
  );
}

function summarizeRuns(runs: RunMetrics[]) {
  const sqlCounts = runs
    .map((run) => run.sqlCount)
    .filter((count): count is number => typeof count === 'number');
  const totalDbTimes = runs
    .map((run) => run.totalDbMs)
    .filter((value): value is number => typeof value === 'number');
  const perStatementTimes = runs
    .map((run) =>
      typeof run.totalDbMs === 'number' && typeof run.sqlCount === 'number' && run.sqlCount > 0
        ? run.totalDbMs / run.sqlCount
        : undefined,
    )
    .filter((value): value is number => typeof value === 'number');

  return {
    averageDuration: average(runs.map((run) => run.durationMs)),
    stddevDuration: stddev(runs.map((run) => run.durationMs)),
    averageSqlCount: sqlCounts.length > 0 ? average(sqlCounts) : undefined,
    averageTotalDbMs: totalDbTimes.length > 0 ? average(totalDbTimes) : undefined,
    averagePerStatementMs: perStatementTimes.length > 0 ? average(perStatementTimes) : undefined,
    stddevPerStatementMs: perStatementTimes.length > 1 ? stddev(perStatementTimes) : 0,
  };
}

function summarizeComponent(
  runs: RunMetrics[],
  selector: (run: RunMetrics) => number | undefined,
): { average?: number; stddev?: number } {
  const values = runs.map(selector).filter((value): value is number => typeof value === 'number');
  if (values.length === 0) {
    return {};
  }
  return {
    average: average(values),
    stddev: values.length > 1 ? stddev(values) : 0,
  };
}

function averageOptional(values: Array<number | undefined>): number | undefined {
  const filtered = values.filter((value): value is number => typeof value === 'number');
  if (filtered.length === 0) {
    return undefined;
  }
  return average(filtered);
}

function clearMetricsFiles(prefix: string): void {
  const dir = path.dirname(prefix);
  const base = path.basename(prefix);
  if (!fs.existsSync(dir)) {
    return;
  }

  // Ensure stale metrics from previous runs do not bleed into new aggregates.
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith(`${base}-`) && entry.endsWith('.json')) {
      fs.rmSync(path.join(dir, entry), { force: true });
    }
  }
  fs.rmSync(`${prefix}.json`, { force: true });
  fs.rmSync(`${prefix}-execution.json`, { force: true });
  fs.rmSync(`${prefix}-steady.json`, { force: true });
  fs.rmSync(`${prefix}-summary.json`, { force: true });
}

type MetricsAggregateResult = {
  metrics: Partial<RunMetrics>;
  usedFiles: string[];
  missingFiles: string[];
};

function aggregateTraditionalMetrics(prefix: string, mode: ExecutionMode): MetricsAggregateResult {
  const dir = path.dirname(prefix);
  const base = path.basename(prefix);
  if (!fs.existsSync(dir)) {
    return { metrics: {}, usedFiles: [], missingFiles: ['metrics files'] };
  }

  const entries = fs
    .readdirSync(dir)
    .filter((entry) => entry.startsWith(`${base}-`) && entry.endsWith('.json'));
  const excludedSuffixes = ['-execution.json', '-steady.json', '-summary.json'];
  const metricEntries = entries.filter(
    (entry) => !excludedSuffixes.some((suffix) => entry.endsWith(suffix)),
  );
  const files = metricEntries.map((entry) => path.join(dir, entry));

  if (files.length === 0) {
    return { metrics: {}, usedFiles: [], missingFiles: ['metrics files'] };
  }

  const metrics = files.map((filePath) => {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as { sqlCount: number; totalDbMs: number };
  });

  const sumCount = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const combineDb = (values: number[]) =>
    mode === 'parallel' ? Math.max(...values) : values.reduce((a, b) => a + b, 0);

  return {
    metrics: {
      sqlCount: sumCount(metrics.map((item) => item.sqlCount)),
      totalDbMs: combineDb(metrics.map((item) => item.totalDbMs)),
    },
    usedFiles: files,
    missingFiles: [],
  };
}

function normalizeMissingEntries(entries: string[]): string[] {
  return Array.from(new Set(entries.filter((entry) => entry.length > 0)));
}

// Track which metric files were produced and optionally escalate on missing data.
function recordMetricsStatus(
  scenario: Scenario,
  mode: ExecutionMode,
  suiteMultiplier: number,
  phase: RunPhase,
  runIndex: number,
  usedFiles: string[],
  missingFiles: string[],
): void {
  const normalizedMissing = normalizeMissingEntries(missingFiles);
  const relativeUsedFiles = usedFiles.map((filePath) => path.relative(ROOT_DIR, filePath));
  const entry: MetricsStatusEntry = {
    scenario,
    mode,
    suiteMultiplier,
    phase,
    runIndex,
    metricsPresent: relativeUsedFiles.length > 0,
    usedFiles: relativeUsedFiles,
    missingFiles: normalizedMissing,
  };
  logMetricsStatus(entry);
  warnOrFailOnMissingMetrics(entry);
}

// Decide whether missing metric files should fail CI or just warn for developer runs.
function warnOrFailOnMissingMetrics(entry: MetricsStatusEntry): void {
  if (entry.missingFiles.length === 0) {
    return;
  }
  const descriptor = `${entry.scenario} (${entry.mode}) multiplier ${entry.suiteMultiplier} ${entry.phase} run ${entry.runIndex}`;
  const message = `Metrics incomplete for ${descriptor}: missing ${entry.missingFiles.join(', ')}.`;
  if (BENCH_PROFILE.name === 'ci') {
    throw new Error(message);
  }
  console.warn(message);
}

function readExecutionMetrics(prefix: string): number | undefined {
  const filePath = `${prefix}-execution.json`;
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const metrics = JSON.parse(raw) as { executionMs?: number };
  return typeof metrics.executionMs === 'number' ? metrics.executionMs : undefined;
}

function readSteadyStateMetrics(prefix: string): SteadyStateMetrics | undefined {
  const filePath = `${prefix}-steady.json`;
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as SteadyStateMetrics;
}

function loadRunMetricsFromDisk(): RunMetrics[] {
  if (!fs.existsSync(TMP_DIR)) {
    return [];
  }

  const results: RunMetrics[] = [];
  for (const entry of fs.readdirSync(TMP_DIR)) {
    if (!entry.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(TMP_DIR, entry);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<RunMetrics>;
    if (parsed.scenario && parsed.mode && typeof parsed.durationMs === 'number') {
      results.push(parsed as RunMetrics);
    }
  }

  return results;
}

function renderReport(
  results: RunMetrics[],
  databaseInfo: string,
  suiteMultipliers: number[],
  steadyStateSuiteMultiplier: number,
  totalBenchmarkDurationMs: number,
): string {
  const now = new Date().toISOString();
  const cpuModel = os.cpus()[0]?.model ?? 'Unknown CPU';
  const logicalCores = os.cpus().length;
  const testCaseNames = ['customer_summary', 'product_ranking', 'sales_summary'];
  const testCaseCount = TRADITIONAL_CASE_COUNT;
  const repositoryCallsPerTest = 1;
  const measured = results.filter((run) => run.phase === 'measured');
  const metricsStatusEntries = getMetricsStatusEntries();
  const suiteSizes = suiteMultipliers.map((multiplier) => TRADITIONAL_CASE_COUNT * multiplier);
  const baselineMultiplier = suiteMultipliers[0] ?? 1;
  const baselineSuiteSize = TRADITIONAL_CASE_COUNT * baselineMultiplier;
  const steadyStateSuiteSize = TRADITIONAL_CASE_COUNT * steadyStateSuiteMultiplier;
  const scenarioSummary = [
    BENCH_SCENARIOS.includeRunner ? 'runner-overhead' : null,
    BENCH_SCENARIOS.includeLowerBound ? 'variable-cost' : null,
    BENCH_SCENARIOS.includeSteady ? 'steady-state' : null,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(', ');
  const steadyStateWarmups = BENCH_SCENARIOS.includeSteady ? STEADY_STATE_WARMUPS : 0;
  const steadyStateMeasuredRuns = BENCH_SCENARIOS.includeSteady ? STEADY_STATE_MEASURED_RUNS : 0;
  const runnerWarmups = BENCH_SCENARIOS.includeRunner ? RUNNER_WARMUP_RUNS : 0;
  const runnerMeasuredRuns = BENCH_SCENARIOS.includeRunner ? RUNNER_MEASURED_RUNS : 0;

  

  type VariableRow = {

    suiteSize: number;

    mode: ExecutionMode;

    scenario: Scenario;

    duration?: number;

    durationStddev?: number;

    dbMs?: number;

    rewriteMs?: number;

    fixtureMs?: number;

    sqlGenMs?: number;

    workerCount: number;

  };



  const variableScenarios: Array<'traditional-in-process' | 'ztd-in-process'> = [

    'traditional-in-process',

    'ztd-in-process',

  ];

  const variableModes: ExecutionMode[] = ['serial', 'parallel'];



  const variableRows: VariableRow[] = [];

  // Collect in-process timing summaries per suite so the new tables can look them up by scenario/mode/worker count.

  for (const multiplier of suiteMultipliers) {

    const suiteSize = TRADITIONAL_CASE_COUNT * multiplier;

    for (const scenario of variableScenarios) {

      for (const mode of variableModes) {

        const workerCounts = mode === 'parallel' ? PARALLEL_WORKER_COUNTS : [1];

        for (const workerCount of workerCounts) {

          const runs = measured.filter(

            (run) =>

              run.scenario === scenario &&

              run.mode === mode &&

              run.suiteMultiplier === multiplier &&

              (run.parallelWorkerCount ?? 1) === workerCount,

          );

          if (runs.length === 0) {

            continue;

          }

          const summary = summarizeRuns(runs);

          const rewriteMs = summarizeComponent(runs, (run) => run.rewriteMs).average;

          const fixtureMs = summarizeComponent(

            runs,

            (run) => run.fixtureMaterializationMs,

          ).average;

          const sqlGenMs = summarizeComponent(runs, (run) => run.sqlGenerationMs).average;

          variableRows.push({

            suiteSize,

            mode,

            scenario,

            duration: summary.averageDuration,

            durationStddev: summary.stddevDuration,

            dbMs: summary.averageTotalDbMs,

            rewriteMs,

            fixtureMs,

            sqlGenMs,

            workerCount,

          });

        }

      }

    }

  }



  const runnerSerialRuns = measured.filter(
    (run) =>
      (run.scenario === 'traditional-runner' || run.scenario === 'ztd-runner') &&
      run.mode === 'serial' &&
      run.suiteMultiplier === baselineMultiplier,
  );
  const runnerStartupMean = summarizeComponent(runnerSerialRuns, (run) => run.startupMs).average;
  const runnerExecutionMean = summarizeComponent(runnerSerialRuns, (run) => run.executionMs).average;


  const variableLookup = new Map<string, VariableRow>();

  // Index each variable row so the summary tables can retrieve measurements without repeated filtering.

  variableRows.forEach((row) => {

    variableLookup.set(

      `${row.suiteSize}:${row.scenario}:${row.mode}:${row.workerCount}`,

      row,

    );

  });



  const suiteTargetConfigs = [

    { label: '30 tests', multiplier: 10 },

    { label: '60 tests', multiplier: 20 },

    { label: '120 tests', multiplier: 40 },

    { label: '240 tests', multiplier: 80 },

  ];

  const suiteTargets = suiteTargetConfigs

    .map((config) => ({

      ...config,

      suiteSize: TRADITIONAL_CASE_COUNT * config.multiplier,

    }))

    .filter((config) => suiteMultipliers.includes(config.multiplier));
  const mediumSuiteTarget = suiteTargets[1] ?? suiteTargets[suiteTargets.length - 1];
  const largeSuiteTarget = suiteTargets[suiteTargets.length - 1] ?? suiteTargets[0];
  const benchPhaseEntries = getBenchPhaseEntries();
  const traditionalWaitingP95 = computePercentile(
    collectTraditionalMetric(benchPhaseEntries, 'acquireClient', 'waitingMs'),
    0.95,
  );
  const traditionalMigrationP95 = computePercentile(
    collectTraditionalMetric(benchPhaseEntries, 'migration', 'durationMs'),
    0.95,
  );
  const traditionalCleanupP95 = computePercentile(
    collectTraditionalMetric(benchPhaseEntries, 'releaseClient', 'cleanupMs'),
    0.95,
  );
  const highlightConnectionModel = BENCH_CONNECTION_MODELS[0] ?? 'perWorker';
  const highlightWorkerCount =
    PARALLEL_WORKER_COUNTS.length > 0
      ? PARALLEL_WORKER_COUNTS.includes(8)
        ? 8
        : PARALLEL_WORKER_COUNTS[PARALLEL_WORKER_COUNTS.length - 1]
      : 1;
  const highlightSuiteMultiplier =
    largeSuiteTarget?.multiplier ??
    suiteMultipliers[suiteMultipliers.length - 1] ??
    1;
  const highlightSuiteLabel =
    largeSuiteTarget?.label ?? `${TRADITIONAL_CASE_COUNT * highlightSuiteMultiplier} tests`;
  const highlightKey = `ztd-in-process|${highlightConnectionModel}|parallel|measured|${highlightSuiteMultiplier}|${highlightWorkerCount}`;
  const ztdWaitingMap = getZtdWaitingMap();
  const ztdSessionMap = getZtdSessionMap();
  const highlightWaitingValues = ztdWaitingMap.get(highlightKey) ?? [];
  const highlightWaitingP95 = computePercentile(highlightWaitingValues, 0.95);
  const highlightSessionValues = ztdSessionMap.get(highlightKey) ?? [];
  const highlightMaxActive =
    highlightSessionValues.length > 0 ? Math.max(...highlightSessionValues) : undefined;



  type MethodDefinition = {

    method: 'traditional' | 'ztd';

    scenario: 'traditional-in-process' | 'ztd-in-process';

    mode: ExecutionMode;

    workerCount: number;

  };



  const traditionalParallelEntries: MethodDefinition[] = PARALLEL_WORKER_COUNTS.map((count) => ({
    method: 'traditional',
    scenario: 'traditional-in-process',
    mode: 'parallel',
    workerCount: count,
  }));
  const ztdParallelEntries: MethodDefinition[] = PARALLEL_WORKER_COUNTS.map((count) => ({
    method: 'ztd',
    scenario: 'ztd-in-process',
    mode: 'parallel',
    workerCount: count,
  }));
  const methodDefinitions: MethodDefinition[] = [
    {
      method: 'traditional',
      scenario: 'traditional-in-process',
      mode: 'serial',
      workerCount: 1,
    },
    ...traditionalParallelEntries,
    {
      method: 'ztd',
      scenario: 'ztd-in-process',
      mode: 'serial',
      workerCount: 1,
    },
    ...ztdParallelEntries,
  ];



  const formatMsOrNa = (value?: number): string =>

    typeof value === 'number' ? formatMs(value) : 'N/A';

  const formatPercentage = (value?: number): string =>

    typeof value === 'number' ? value.toFixed(1) : 'N/A';



  const ztdSteadyRuns = measured.filter(

    (run) => run.scenario === 'ztd-steady-state' && run.phase === 'measured',

  );

  const flattenSteadyValues = (key: keyof SteadyStateMetrics): number[] => {

    const values: number[] = [];

    for (const run of ztdSteadyRuns) {

      const steady = run.steadyState;

      if (!steady) {

        continue;

      }

      const metric = steady[key];

      if (Array.isArray(metric)) {

        values.push(...metric);

      }

    }

    return values;

  };

  const averageIfAny = (values: number[]): number | undefined =>

    values.length > 0 ? average(values) : undefined;

  const componentEntries = [

    { name: 'Parse', mean: averageIfAny(flattenSteadyValues('iterationOtherMs')) },

    { name: 'ZTD transform', mean: averageIfAny(flattenSteadyValues('iterationRewriteMs')) },

    { name: 'Stringify', mean: averageIfAny(flattenSteadyValues('iterationSqlGenerationMs')) },

    { name: 'DB execution', mean: averageIfAny(flattenSteadyValues('iterationDbMs')) },

  ];

  const componentTotal = componentEntries.reduce(

    (sum, entry) => sum + (typeof entry.mean === 'number' ? entry.mean : 0),

    0,

  );

  const percentageFor = (value?: number): number | undefined =>

    componentTotal > 0 && typeof value === 'number' ? (value / componentTotal) * 100 : undefined;



  const reportLines: string[] = [];

  reportLines.push('## ZTD Benchmark Results');

  reportLines.push('');

  reportLines.push('**Environment**');

  reportLines.push(`- Node.js: ${process.version}`);

  reportLines.push(`- Database: ${databaseInfo}`);

  reportLines.push(`- OS: ${os.type()} ${os.release()}`);

  reportLines.push(`- CPU: ${cpuModel.trim()} (${logicalCores} logical cores)`);

  reportLines.push(`- Date: ${now}`);

  reportLines.push('');

  reportLines.push('**Benchmark Configuration**');

  reportLines.push(`- Profile: ${BENCH_PROFILE.name}`);

  reportLines.push(`- Scenarios: ${scenarioSummary.length > 0 ? scenarioSummary : 'none'}`);

  reportLines.push(`- Warmup runs (baseline multiplier only): ${WARMUP_RUNS}`);

  reportLines.push(`- Measured runs base: ${MEASURED_RUNS}`);

  reportLines.push(

    `- Suite sizes tested: ${suiteSizes.map((size) => `${size} tests`).join(', ')}`,

  );

  reportLines.push(

    `- Steady-state suite size: ${steadyStateSuiteSize} tests`,

  );

  if (BENCH_SCENARIOS.includeSteady) {

    reportLines.push(

      `- Steady-state runs: ${steadyStateWarmups} warmup / ${steadyStateMeasuredRuns} measured`,

    );

  }

  if (BENCH_SCENARIOS.includeLowerBound) {

    reportLines.push(

      `- Variable cost suites measured: ${suiteSizes.map((size) => `${size} tests`).join(', ')}`,

    );

  }

  reportLines.push(

    `- Parallel workers tested: ${PARALLEL_WORKER_COUNTS.join(', ')}`,

  );

  reportLines.push(

    `- Total benchmark duration: ${formatMsOrNa(totalBenchmarkDurationMs)} ms`,

  );

  reportLines.push('');



  const measuredRunsLabel = resolveMeasuredRunsForMultiplier(suiteMultipliers[0] ?? baselineMultiplier);

  const formatSpeedup = (value?: number): string =>

    typeof value === 'number' ? value.toFixed(2) : 'N/A';



  reportLines.push('### Variable Cost Comparison');

  reportLines.push('');

  reportLines.push(

    'This section compares per-iteration variable work. Fixed runner and worker startup costs are excluded so that watch-style iterations highlight the work that grows with suite size.',

  );

  reportLines.push('');

  reportLines.push(

    `- Means/StdDev computed over ${measuredRunsLabel} measured runs (warmups excluded).`,

  );

  reportLines.push(

    '- Parallelism reflects Vitest worker processes (test runner workers), not DB threads.',

  );

  reportLines.push(

    '- Speedup vs traditional (1 worker) uses the traditional serial mean as the baseline for each suite size.',

  );

  reportLines.push('');

  for (const target of suiteTargets) {

    reportLines.push(`#### ${target.label}`);

    reportLines.push('');

    reportLines.push(

      '| Method | Parallelism (workers) | Mean (ms) | StdDev (ms) | Speedup vs traditional (1 worker) |',

    );

    reportLines.push('| --- | ---: | ---: | ---: | ---: |');

    const baselineKey = `${target.suiteSize}:traditional-in-process:serial:1`;

    const baselineMean = variableLookup.get(baselineKey)?.duration;

    if (typeof baselineMean !== 'number' || baselineMean <= 0) {

      reportLines.push(

        '| _Insufficient baseline data_ |  |  |  |  |',

      );

      reportLines.push('');

      continue;

    }

    for (const method of methodDefinitions) {

      const key = `${target.suiteSize}:${method.scenario}:${method.mode}:${method.workerCount}`;

      const row = variableLookup.get(key);

      if (!row || typeof row.duration !== 'number') {

        continue;

      }

      const mean = row.duration;

      const stddev = row.durationStddev;

      const baselineSpeedup =

        typeof baselineMean === 'number' && baselineMean > 0 ? baselineMean / mean : undefined;

      const speedup =

        method.method === 'traditional' && method.workerCount === 1 ? 1 : baselineSpeedup;

      reportLines.push(

        `| ${method.method} | ${method.workerCount} | ${formatMsOrNa(mean)} | ${formatMsOrNa(

          stddev,

        )} | ${formatSpeedup(speedup)} |`,

      );

    }

    reportLines.push('');

  }



  const parallelTraditionalRuns = measured.filter(
    (run) => run.scenario === 'traditional-in-process' && run.mode === 'parallel' && run.phase === 'measured',
  );
  const formatInteger = (value?: number): string => (typeof value === 'number' ? value.toFixed(0) : 'N/A');
  const formatWorkerOffset = (value?: number): string =>
    typeof value === 'number' ? `${formatMs(value)}ms` : 'N/A';
  const parallelDurations = parallelTraditionalRuns
    .map((run) => run.durationMs)
    .filter((value): value is number => typeof value === 'number');
  const traditionalParallelP95 = computePercentile(parallelDurations, 0.95);
  reportLines.push(
    `- Traditional parallel duration p95: ${formatMsOrNa(traditionalParallelP95)}`,
  );
  reportLines.push(
    `- Traditional parallel waiting p95: ${formatMsOrNa(traditionalWaitingP95)} ms`,
  );
  reportLines.push(
    `- Traditional migration p95: ${formatMsOrNa(traditionalMigrationP95)} ms`,
  );
  reportLines.push(
    `- Traditional cleanup p95: ${formatMsOrNa(traditionalCleanupP95)} ms`,
  );
  reportLines.push('### Traditional Parallelism Validation');
  reportLines.push('');
  reportLines.push(
    'Traditional parallel runs show overlapping worker time ranges and multiple concurrent PostgreSQL sessions in the first measured iteration for each suite and worker count.',
  );
  reportLines.push('');
  for (const target of suiteTargets) {
    reportLines.push(`- ${target.label}:`);
    for (const workerCount of PARALLEL_WORKER_COUNTS) {
      const candidateRuns = parallelTraditionalRuns
        .filter(
          (run) =>
            run.suiteMultiplier === target.multiplier &&
            run.parallelWorkerCount === workerCount,
        )
        .sort((a, b) => (a.runIndex ?? 0) - (b.runIndex ?? 0));
      if (candidateRuns.length === 0) {
        reportLines.push(`  - Workers: ${workerCount}: no measured run recorded.`);
        continue;
      }
      const representative = candidateRuns[0];
      reportLines.push(`  - Workers: ${workerCount}`);
      reportLines.push(
        `    - Peak concurrent PG sessions: ${formatInteger(
          representative.traditionalPeakConnections,
        )}`,
      );
      const ranges = representative.traditionalWorkerTimeRanges;
      if (ranges && ranges.length > 0) {
        reportLines.push('    - Worker time ranges:');
        ranges.forEach((range) => {
          reportLines.push(
            `      - ${range.workerId}: ${formatWorkerOffset(range.startOffsetMs)}..${formatWorkerOffset(
              range.endOffsetMs,
            )} (cases: ${range.cases})`,
          );
        });
      } else {
        reportLines.push('    - Worker time ranges: N/A');
      }
    }
  }
  reportLines.push('');

  reportLines.push('### ZTD Concurrency Diagnostics');
  reportLines.push('');
  reportLines.push(
    `- Highlighted ZTD in-process run: ${highlightSuiteLabel} with ${highlightWorkerCount} workers (${highlightConnectionModel} connection model, parallel measured).`,
  );
  reportLines.push(
    `  - Waiting p95: ${formatMsOrNa(highlightWaitingP95)} ms`,
  );
  reportLines.push(
    `  - Max active PostgreSQL sessions observed: ${typeof highlightMaxActive === 'number' ? highlightMaxActive : 'N/A'}`,
  );
  reportLines.push('');

  reportLines.push('### Runner Overhead (Supplementary)');

  reportLines.push('');

  reportLines.push('Runner overhead (first run only):');
  reportLines.push(`- Startup: ${formatMsOrNa(runnerStartupMean)} ms`);
  reportLines.push(`- Execution (no-op suite): ${formatMsOrNa(runnerExecutionMean)} ms`);
  reportLines.push('');

  reportLines.push(

    'This overhead is paid once in watch or iterative workflows and is amortized away. For one-shot executions (manual runs or fresh CI jobs), this cost is incurred on every run and should be added to the variable cost.',

  );

  reportLines.push('');



  reportLines.push('### ZTD Internal Cost Breakdown');

  reportLines.push('');

  reportLines.push('| Component | Mean (ms) | Percentage (%) |');

  reportLines.push('| --- | ---: | ---: |');

  for (const entry of componentEntries) {

    reportLines.push(

      `| ${entry.name} | ${formatMsOrNa(entry.mean)} | ${formatPercentage(

        percentageFor(entry.mean),

      )} |`,

    );

  }

  reportLines.push('');



  reportLines.push('### Notes');

  if (mediumSuiteTarget) {
    reportLines.push(

      `- The ${mediumSuiteTarget.label} suite repeats the same ${testCaseCount} cases to approximate larger suite sizes for the variable cost measurements.`,

    );
  }

  if (largeSuiteTarget) {
    reportLines.push(

      `- The ${largeSuiteTarget.label} suite relies on the existing suite-scaling mechanism to repeat the same case set while preserving the measurement scope.`,

    );
  }

  reportLines.push(

    '- Traditional variable cost assumes hand-authored SQL and DDL, so SQL generation plus migration creation are treated as zero to keep this baseline as a best-case scenario.',

  );

  reportLines.push(

    '- Traditional parallel runs rely on schema-isolated setup (unique schemas/search_path per test) to avoid shared state, which adds hidden engineering work to generate and track isolation metadata.',

  );

  reportLines.push(

    '- Traditional in-process runs open per-case PG connections to mirror migration workflows, whereas ZTD in-process runs reuse a shared pg-testkit connection because fixture materialization couples to that queryable; further pooling is not feasible.',

  );

  reportLines.push(

    '- Aggressive multi-statement batching (minimum round-trip optimization) was intentionally not used because it weakens failure isolation, cleanup guarantees, and schema/search_path isolation in parallel runs.',

  );

  reportLines.push(

    '- Representative Traditional SQL sequences are written to tmp/bench/traditional-sql/<case>.sql (one file per case) so you can inspect the migration, seeding, query, and cleanup statements without capturing every repetition.',

  );

  reportLines.push(

    '- ZTD variable cost includes repository SQL generation (when applicable), rewrite, fixture materialization, and DB execution within each measured run.',

  );

  reportLines.push(

    '- Runner-only overhead rows measure pnpm + vitest startup and execution through a minimal no-op suite so fixed runner cost is isolated from variable measurements.',

  );

  reportLines.push('- Postgres container startup is excluded (the container is shared across all runs).');

  reportLines.push(

    '- Results are averaged over the measured run counts listed above (warmups excluded).',

  );

  reportLines.push('');

  reportLines.push('### Reproduction');

  reportLines.push('```bash');

  reportLines.push('pnpm ztd:bench');

  reportLines.push('```');

  reportLines.push(`Report path: ${path.relative(ROOT_DIR, REPORT_PATH)}`);



  return `${reportLines.join('\n')}\n`;

}

async function fetchPostgresVersion(databaseUrl: string): Promise<string> {
  void databaseUrl;
  const { client, release } = await getDbClient({
    scope: 'case',
    applicationName: 'ztd-bench-version',
  });
  // Use a disposable connection so this version query does not interfere with pooled workloads.
  try {
    const result = await client.query<{ version: string }>('SELECT version() as version');
    return result.rows[0]?.version ?? 'Unknown';
  } finally {
    await release();
  }
}

async function runScenario(
  scenario: Scenario,
  mode: ExecutionMode,
  databaseUrl: string,
  runs: number,
  suiteMultiplier: number,
  phase: RunPhase,
): Promise<RunMetrics[]> {
  const scenarioStartMs = Date.now();
  const scenarioStart = new Date(scenarioStartMs).toISOString();
  console.log(
    `[${scenarioStart}] Starting ${scenario} (${mode}, phase=${phase}) suite x${suiteMultiplier} (${runs} runs planned).`,
  );
  const results: RunMetrics[] = [];
  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    const runContext: BenchContext = {
      scenario,
      mode,
      suiteMultiplier,
      runIndex,
      phase,
      parallelWorkerCount: mode === 'parallel' ? getActiveParallelWorkers() : 1,
    };
    logBenchProgress('run.start', runContext);
    let runMetrics: RunMetrics;
    if (scenario === 'ztd-runner') {
      runMetrics = await runZtdRunnerSuite(mode, runIndex, databaseUrl, suiteMultiplier, phase);
    } else if (scenario === 'traditional-runner') {
      runMetrics = await runTraditionalSuiteViaRunner(
        mode,
        runIndex,
        databaseUrl,
        suiteMultiplier,
        phase,
      );
    } else if (scenario === 'ztd-in-process') {
      runMetrics = await runZtdInProcessSuite(mode, runIndex, databaseUrl, suiteMultiplier, phase);
    } else if (scenario === 'ztd-steady-state') {
      runMetrics = await runZtdSteadyStateSuite(mode, runIndex, databaseUrl, suiteMultiplier, phase);
    } else if (scenario === 'traditional-steady-state') {
      runMetrics = await runTraditionalSteadyStateSuite(
        mode,
        runIndex,
        databaseUrl,
        suiteMultiplier,
        phase,
      );
    } else {
      runMetrics = await runTraditionalSuiteLowerBound(
        mode,
        runIndex,
        databaseUrl,
        suiteMultiplier,
        phase,
      );
    }
    logBenchProgress('run.end', runContext, {
      durationMs: runMetrics.durationMs,
    });
    runMetrics.runIndex = runIndex;
    runMetrics.parallelWorkerCount =
      runMetrics.mode === 'parallel' ? getActiveParallelWorkers() : 1;
    results.push(runMetrics);
  }
  const scenarioEndMs = Date.now();
  const scenarioEnd = new Date(scenarioEndMs).toISOString();
  console.log(
    `[${scenarioEnd}] Completed ${scenario} (${mode}, phase=${phase}) suite x${suiteMultiplier} (${runs} runs) in ${formatMs(
      scenarioEndMs - scenarioStartMs,
    )} ms.`,
  );
  return results;
}

function collectTraditionalMetric(
  entries: BenchPhaseLogEntry[],
  phaseName: string,
  metric: 'waitingMs' | 'durationMs' | 'cleanupMs',
): number[] {
  return entries
    .filter(
      (entry) =>
        entry.phase === phaseName &&
        entry.status === 'end' &&
        entry.context?.approach === 'traditional' &&
        entry.context.phase === 'measured' &&
        entry.context.mode === 'parallel' &&
        typeof entry[metric] === 'number',
    )
    .map((entry) => entry[metric] as number);
}

async function main(): Promise<void> {
  const benchStartMs = Date.now();
  ensureDirectories();
  clearMetricsStatus();
  clearConnectionEvents();
  clearSessionStats();
  clearWorkerActivities();
  clearZtdDiagnostics();

  const warmups: RunMetrics[] = [];
  const measured: RunMetrics[] = [];
  const suiteMultipliers = SUITE_MULTIPLIERS;
  const baselineMultiplier = suiteMultipliers[0] ?? 1;
  const baselineSuiteSize = TRADITIONAL_CASE_COUNT * baselineMultiplier;
  const steadyStateSuiteMultiplier = STEADY_STATE_SUITE_MULTIPLIER;
  const steadyStateWarmups = BENCH_SCENARIOS.includeSteady ? STEADY_STATE_WARMUPS : 0;
  const steadyStateMeasuredRuns = BENCH_SCENARIOS.includeSteady
    ? STEADY_STATE_MEASURED_RUNS
    : 0;
  const runnerWarmups = BENCH_SCENARIOS.includeRunner ? RUNNER_WARMUP_RUNS : 0;
  const runnerMeasuredRuns = BENCH_SCENARIOS.includeRunner ? RUNNER_MEASURED_RUNS : 0;

  logBenchProgress(
    'bench.start',
    {
      scenario: 'benchmark-setup',
    },
    {
      detail: 'Benchmark run initiated',
      profile: BENCH_PROFILE.name,
      scenarios: BENCH_SCENARIOS.label,
      connectionModels: BENCH_CONNECTION_MODELS,
      suiteMultipliers,
      steadyStateSuiteMultiplier,
      steadyStateWarmups,
      steadyStateMeasuredRuns,
      runnerWarmups,
      runnerMeasuredRuns,
    },
  );
  console.log(
    `Starting ZTD benchmark (profile=${BENCH_PROFILE.name}, scenarios=${BENCH_SCENARIOS.label}, log level=${REQUESTED_LOG_LEVEL}).`,
  );

  const container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('ztd_benchmark')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const databaseUrl = container.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;

  try {

    for (const connectionModel of BENCH_CONNECTION_MODELS) {
      setActiveConnectionModel(connectionModel);
      logBenchProgress(
        'bench.connection-model',
        {
          scenario: 'benchmark-setup',
          connectionModel,
        },
        {
          detail: `Running experiments with BENCH_CONNECTION_MODEL=${connectionModel}`,
          profile: BENCH_PROFILE.name,
          scenarios: BENCH_SCENARIOS.label,
          suiteMultipliers,
          steadyStateSuiteMultiplier,
        },
      );

      if (BENCH_SCENARIOS.includeRunner) {
        const runnerScenarios: Scenario[] = ['ztd-runner', 'traditional-runner'];
        const runnerModes: ExecutionMode[] = ['serial', 'parallel'];

        if (runnerWarmups > 0) {
          logBenchProgress(
            'bench.stage',
            {
              scenario: 'runner-overhead',
              mode: 'warmup',
              suiteMultiplier: baselineMultiplier,
            },
            {
              detail: `Warmup: runner-only overhead (${baselineSuiteSize} tests baseline configuration)`,
              warmupRuns: runnerWarmups,
            },
          );
          for (const scenario of runnerScenarios) {
            for (const mode of runnerModes) {
              const workerCounts = mode === 'parallel' ? PARALLEL_WORKER_COUNTS : [1];
              for (const workerCount of workerCounts) {
                setActiveParallelWorkers(workerCount);
                warmups.push(
                  ...(await runScenario(
                    scenario,
                    mode,
                    databaseUrl,
                    runnerWarmups,
                    baselineMultiplier,
                    'warmup',
                  )),
                );
              }
            }
          }
        }

        logBenchProgress(
          'bench.stage',
          {
            scenario: 'runner-overhead',
            mode: 'measured',
            suiteMultiplier: baselineMultiplier,
          },
          {
            detail: `Measured: runner-only overhead (${baselineSuiteSize} tests baseline configuration)`,
            measuredRuns: runnerMeasuredRuns,
          },
        );
        for (const scenario of runnerScenarios) {
          for (const mode of runnerModes) {
            const workerCounts = mode === 'parallel' ? PARALLEL_WORKER_COUNTS : [1];
            for (const workerCount of workerCounts) {
              setActiveParallelWorkers(workerCount);
              measured.push(
                ...(await runScenario(
                  scenario,
                  mode,
                  databaseUrl,
                  runnerMeasuredRuns,
                  baselineMultiplier,
                  'measured',
                )),
              );
            }
          }
        }
      }

      if (BENCH_SCENARIOS.includeLowerBound) {
        const variableScenarios: Scenario[] = ['traditional-in-process', 'ztd-in-process'];
        const variableModes: ExecutionMode[] = ['serial', 'parallel'];
        for (const suiteMultiplier of suiteMultipliers) {
          const suiteSize = TRADITIONAL_CASE_COUNT * suiteMultiplier;
          const warmupRuns = shouldWarmupMultiplier(suiteMultiplier, baselineMultiplier)
            ? WARMUP_RUNS
            : 0;
          const measuredRuns = resolveMeasuredRunsForMultiplier(suiteMultiplier);

          if (warmupRuns > 0) {
            logBenchProgress(
              'bench.stage',
              {
                scenario: 'variable-cost',
                mode: 'warmup',
                suiteMultiplier,
              },
              {
                detail: `Warmup: in-process variable cost (${suiteSize} tests)`,
                warmupRuns,
              },
            );
            for (const scenario of variableScenarios) {
              for (const mode of variableModes) {
                const workerCounts = mode === 'parallel' ? PARALLEL_WORKER_COUNTS : [1];
                for (const workerCount of workerCounts) {
                  setActiveParallelWorkers(workerCount);
                  warmups.push(
                    ...(await runScenario(
                      scenario,
                      mode,
                      databaseUrl,
                      warmupRuns,
                      suiteMultiplier,
                      'warmup',
                    )),
                  );
                }
              }
            }
          }

          logBenchProgress(
            'bench.stage',
            {
              scenario: 'variable-cost',
              mode: 'measured',
              suiteMultiplier,
            },
            {
              detail: `Measured: in-process variable cost (${suiteSize} tests)`,
              measuredRuns,
            },
          );
          for (const scenario of variableScenarios) {
            for (const mode of variableModes) {
              const workerCounts = mode === 'parallel' ? PARALLEL_WORKER_COUNTS : [1];
              for (const workerCount of workerCounts) {
                setActiveParallelWorkers(workerCount);
                measured.push(
                  ...(await runScenario(
                    scenario,
                    mode,
                    databaseUrl,
                    measuredRuns,
                    suiteMultiplier,
                    'measured',
                  )),
                );
              }
            }
          }
        }
      }

      if (BENCH_SCENARIOS.includeSteady) {
      if (steadyStateWarmups > 0) {
        logBenchProgress(
          'bench.stage',
          {
            scenario: 'steady-state',
            mode: 'warmup',
            suiteMultiplier: steadyStateSuiteMultiplier,
          },
          {
            detail: `Warmup: steady-state (suite multiplier ${steadyStateSuiteMultiplier})`,
            warmupRuns: steadyStateWarmups,
          },
        );
        warmups.push(
          ...(await runScenario(
            'traditional-steady-state',
            'serial',
            databaseUrl,
            steadyStateWarmups,
            steadyStateSuiteMultiplier,
            'warmup',
          )),
        );
        warmups.push(
          ...(await runScenario(
            'ztd-steady-state',
            'serial',
            databaseUrl,
            steadyStateWarmups,
            steadyStateSuiteMultiplier,
            'warmup',
          )),
        );
        for (const workerCount of PARALLEL_WORKER_COUNTS) {
          setActiveParallelWorkers(workerCount);
          warmups.push(
            ...(await runScenario(
              'ztd-steady-state',
              'parallel',
              databaseUrl,
              steadyStateWarmups,
              steadyStateSuiteMultiplier,
              'warmup',
            )),
          );
        }
      }

      logBenchProgress(
        'bench.stage',
        {
          scenario: 'steady-state',
          mode: 'measured',
          suiteMultiplier: steadyStateSuiteMultiplier,
        },
        {
          detail: `Measured: steady-state (suite multiplier ${steadyStateSuiteMultiplier})`,
          measuredRuns: steadyStateMeasuredRuns,
        },
      );
      measured.push(
        ...(await runScenario(
          'traditional-steady-state',
          'serial',
          databaseUrl,
          steadyStateMeasuredRuns,
          steadyStateSuiteMultiplier,
          'measured',
        )),
      );
      measured.push(
        ...(await runScenario(
          'ztd-steady-state',
          'serial',
          databaseUrl,
          steadyStateMeasuredRuns,
          steadyStateSuiteMultiplier,
          'measured',
        )),
      );
      for (const workerCount of PARALLEL_WORKER_COUNTS) {
        setActiveParallelWorkers(workerCount);
        measured.push(
          ...(await runScenario(
            'ztd-steady-state',
            'parallel',
            databaseUrl,
            steadyStateMeasuredRuns,
            steadyStateSuiteMultiplier,
            'measured',
          )),
        );
      }
    }
  }

    const postgresVersion = await fetchPostgresVersion(databaseUrl);
    const recordedRuns = loadRunMetricsFromDisk();
    const totalBenchmarkDurationMs = Date.now() - benchStartMs;
    const report = renderReport(
      recordedRuns,
      postgresVersion,
      suiteMultipliers,
      steadyStateSuiteMultiplier,
      totalBenchmarkDurationMs,
    );
    fs.writeFileSync(REPORT_PATH, report, 'utf8');

    logBenchProgress(
      'bench.end',
      {},
      {
        detail: 'Benchmark run complete',
        warmupRuns: warmups.length,
        measuredRuns: measured.length,
        reportPath: path.relative(ROOT_DIR, REPORT_PATH),
        logPath: path.relative(ROOT_DIR, BENCH_LOG_PATH),
        totalDurationMs: totalBenchmarkDurationMs,
      },
    );
    console.log(
      `ZTD benchmark complete (warmups: ${warmups.length}, measured: ${measured.length}). Report: ${path.relative(
        ROOT_DIR,
        REPORT_PATH,
      )}; log: ${path.relative(ROOT_DIR, BENCH_LOG_PATH)}.`,
    );
  } finally {
    // Ensure the benchmark log stream flushes before closing database resources.
    closeBenchmarkLogger();
    // Tear down the shared pool before stopping the container so connections cleanly release.
    await closeDbPool();
    await container.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
