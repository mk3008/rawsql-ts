import fs from 'node:fs';
import path from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import {
  CUSTOMER_ROWS,
  PRODUCT_ROWS,
  SALES_ORDER_ITEM_ROWS,
  SALES_ORDER_ROWS,
  TRADITIONAL_CASES,
} from './support/traditional-bench-data';
import type { ZtdBenchMetrics } from './ztd-bench/tests/support/testkit-client';
import { buildBenchSchemaName } from './ztd-bench/tests/support/bench-suite';
import {
  ConnectionLogger,
  ConnectionModel,
  DbConcurrencyMode,
  RunPhase,
  SessionStat,
  appendSessionStats,
  clearConnectionEvents,
  clearSessionStats,
  getConnectionEvents,
  getSessionStats,
  recordConnectionEvent,
  recordSessionStat,
  type ConnectionLoggerEntry,
} from './ztd-bench/tests/support/diagnostics';
import { getDbClient, releaseWorkerClient, closeDbPool } from './support/db-client';
import { runTraditionalParallelismValidation } from './support/traditional-parallelism-validation';
import { safeStopSampler, SessionSampler } from './support/session-sampler';
import {
  BenchContext,
  closeBenchmarkLogger,
  configureBenchmarkLogger,
  getBenchPhaseEntries,
  logBenchPhase,
  logBenchProgress,
  resetBenchmarkLog,
} from './support/benchmark-logger';
import {
  clearZtdDiagnostics,
  getZtdSessionMap,
  getZtdWaitingMap,
  recordZtdSession,
} from './ztd-bench/tests/support/bench-diagnostics';
import {
  loadPersistedSessionStats,
  persistSessionStatsToDisk,
} from './bench-runner/diagnostics/session-stats';
import { persistConnectionEventsToDisk } from './bench-runner/diagnostics/connection-events';
import { platformCommand, runCommand } from './bench-runner/runner/commands';
import {
  BENCH_LOG_PATH,
  APPENDIX_REPORT_PATH,
  REPORT_PATH,
  REPORT_METADATA_PATH,
  ROOT_DIR,
  RUN_TAG_PREFIX,
  TMP_DIR,
  TRADITIONAL_SQL_LOG_DIR,
} from './bench-runner/runtime/paths';
import {
  startPgConcurrencyMonitor,
  type PgConcurrencySummary,
} from './support/pg-concurrency';
import { appendWorkerTag } from './support/worker-tag';
import {
  resolveBenchConnectionModels,
  resolveBenchProfile,
  resolveBenchScenarios,
  resolveDbConcurrencyMode,
  resolveNumberSetting,
  resolveParallelWorkerCounts,
  resolveSuiteMultipliers,
  resolveSteadyStateIterations,
  resolveTraditionalDbSerialLockKey,
} from './bench-runner/config';
import {
  aggregateTraditionalMetrics,
  clearMetricsFiles,
  clearMetricsStatus,
  configureMetricsContext,
  getMetricsStatusEntries,
  loadRunMetricsFromDisk,
  readExecutionMetrics,
  readSteadyStateMetrics,
  recordMetricsStatus,
} from './bench-runner/metrics';
import { formatMs } from './bench-runner/utils';
import type {
  BenchScenarioSelection,
  ExecutionMode,
  RecordedStatement,
  RunMetrics,
  Scenario,
  SteadyStateMetrics,
  TraditionalParallelDiagnostic,
} from './bench-runner/types';
import {
  captureAndResetWorkerTimeRanges,
  clearCurrentTraditionalDiagnostic,
  clearWorkerActivities,
  getActiveConnectionModel,
  getActiveParallelWorkers,
  getCurrentTraditionalDiagnostic,
  parallelValidationTokens,
  recordWorkerCaseCompletion,
  recordWorkerCaseStart,
  recordWorkerMigrationStatements,
  setActiveConnectionModel,
  setActiveParallelWorkers,
  setCurrentTraditionalDiagnostic,
} from './bench-runner/state';
import {
  TRADITIONAL_CASE_COUNT,
  ZTD_CASE_RUNNERS,
} from './bench-runner/benchmark-data';
import { resolveMeasuredRunsForMultiplier, shouldWarmupMultiplier } from './bench-runner/benchmark-helpers';
import { writeBenchmarkReports } from './bench-runner/report/report-writer';
import { writeReportMetadata } from './bench-runner/report/report-metadata';
import { runAnalysisOnlyFromDisk } from './bench-runner/report/report-analysis';


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
  applicationName: string;
}> {
  // Resolve the per-case vs per-worker scope so the connection model stays explicit.
  const scope = options.connectionModel === 'perWorker' ? 'worker' : 'case';
  const connectionAppNameBase = `ztd-bench-traditional-${options.mode}-${options.caseName}`;
  const connectionAppName =
    options.connectionModel === 'perWorker'
      ? appendWorkerTag(connectionAppNameBase, options.workerId)
      : connectionAppNameBase;
  const { client, pid, release } = await getDbClient({
    scope,
    workerId: options.workerId,
    applicationName: connectionAppName,
  });
  // Wrap the raw client so the caller only needs a simple query helper.
  const queryable = (text: string, values?: unknown[]) => client.query(text, values);
  return { queryable, pid, release, applicationName: connectionAppName };
}

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
configureMetricsContext({
  rootDir: ROOT_DIR,
  benchProfileName: BENCH_PROFILE.name,
});
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
const PARALLEL_WORKER_COUNTS = resolveParallelWorkerCounts(DIAGNOSTIC_MODE);
setActiveParallelWorkers(PARALLEL_WORKER_COUNTS[0] ?? (DIAGNOSTIC_MODE ? 1 : 4));
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
const DB_CONCURRENCY_MODE = resolveDbConcurrencyMode();
const ANALYSIS_ONLY = process.env.ZTD_BENCH_ANALYSIS_ONLY === '1';
const ENFORCE_PER_WORKER_CONCURRENCY =
  process.env.ZTD_BENCH_ENFORCE_PER_WORKER_CONCURRENCY !== '0';
const TRADITIONAL_DB_SERIAL_LOCK = process.env.TRADITIONAL_DB_SERIAL_LOCK === '1';
const TRADITIONAL_DB_SERIAL_GUARD_OVERRIDE = process.env.TRADITIONAL_DB_SERIAL_GUARD_OVERRIDE === '1';
const TRADITIONAL_DB_SERIAL_LOCK_KEY = resolveTraditionalDbSerialLockKey();
const sharedConnectionLogger: ConnectionLogger = (entry) => {
  recordConnectionEvent(entry);
};
const RUNNER_WARMUP_RUNS = 0;
const RUNNER_MEASURED_RUNS = 1;
const STEADY_STATE_WARMUPS = 1;
const STEADY_STATE_MEASURED_RUNS = 3;

const TRADITIONAL_SQL_LOGGED_CASES = new Set<string>();

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

function ensureDirectories(): void {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

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

function annotateParallelWorkerCount(runMetrics: RunMetrics, mode: ExecutionMode): void {
  runMetrics.parallelWorkerCount = mode === 'parallel' ? getActiveParallelWorkers() : 1;
}


type ScenarioMatrixOptions = {
  scenarios: Scenario[];
  modes: ExecutionMode[];
  runs: number;
  suiteMultiplier: number;
  phase: RunPhase;
  databaseUrl: string;
  forceTraditionalSerial?: boolean;
};

async function runScenarioMatrix(options: ScenarioMatrixOptions): Promise<RunMetrics[]> {
  const results: RunMetrics[] = [];
  for (const scenario of options.scenarios) {
    for (const mode of options.modes) {
      const workerCounts = mode === 'parallel' ? PARALLEL_WORKER_COUNTS : [1];
      for (const workerCount of workerCounts) {
        // Align active worker count with the scenario/mode combination.
        setActiveParallelWorkers(workerCount);
        results.push(
          ...(await runScenario(
            scenario,
            mode,
            options.databaseUrl,
            options.runs,
            options.suiteMultiplier,
            options.phase,
            options.forceTraditionalSerial ?? false,
          )),
        );
      }
    }
  }
  return results;
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
    `${RUN_TAG_PREFIX}ztd-runner-${phase}-${mode}-${suiteMultiplier}-${runIndex}-${parallelWorkerCount}`,
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
  await runCommand(pnpm, args, env, { cwd: ROOT_DIR });
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
    `${RUN_TAG_PREFIX}ztd-in-process-${DB_CONCURRENCY_MODE}-${phase}-${mode}-${suiteMultiplier}-${runIndex}-${parallelWorkerCount}`,
  );
  const concurrencyLabel = DB_CONCURRENCY_MODE === 'perWorker' ? 'perworker' : 'single';
  const applicationName = `ztd-bench-${concurrencyLabel}`;
  const metricsPath = `${metricsPrefix}.json`;

  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  const perWorkerConnections = getActiveConnectionModel() === 'perWorker';
  const sessionWorkerCount =
    perWorkerConnections && mode === 'parallel'
      ? Math.max(1, getActiveParallelWorkers())
      : 1;
  // Keep report worker counts aligned with the Vitest worker count even when DB concurrency is serialized.
  const reportWorkerCount = mode === 'parallel' ? Math.max(1, getActiveParallelWorkers()) : 1;
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
          parallelWorkerCount: reportWorkerCount,
          applicationName,
          dbConcurrencyMode: DB_CONCURRENCY_MODE,
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
      dbConcurrencyMode: DB_CONCURRENCY_MODE,
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
    clearCurrentTraditionalDiagnostic();
    const sessionSummary = await safeStopSampler(sampler);
    recordZtdSession(
      {
        scenario: 'ztd-in-process',
        connectionModel: getActiveConnectionModel(),
        mode,
        phase,
        suiteMultiplier,
        workerCount: reportWorkerCount,
        dbConcurrencyMode: DB_CONCURRENCY_MODE,
      },
      {
        maxActiveExecuting: sessionSummary.maxActiveExecuting,
        maxLockWait: sessionSummary.maxLockWait,
      },
    );
    recordSessionStat({
      scenarioLabel: 'ztd-in-process',
      mode,
      phase,
      suiteMultiplier,
      runIndex,
      workerCount: reportWorkerCount,
      dbConcurrencyMode: DB_CONCURRENCY_MODE,
      maxTotalSessions: sessionSummary.maxTotal,
      maxActiveExecutingSessions: sessionSummary.maxActiveExecuting,
      maxLockWaitSessions: sessionSummary.maxLockWait,
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
    enforceSerialDb?: boolean;
    serialLockKey?: number;
    parallelWorkerCount?: number;
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
    note: context.enforceSerialDb ? 'serial-lock' : undefined,
  };
  const workerId = context.workerId;
  recordWorkerCaseStart(connectionModel, context.scenarioLabel, mode, workerId);
  const { queryable, pid, release, applicationName } = await acquireTraditionalQueryable({
    connectionModel,
    workerId: context.workerId,
    mode,
    caseName,
    context: benchContext,
  });
  const serialLockKey = context.serialLockKey ?? TRADITIONAL_DB_SERIAL_LOCK_KEY;
  const lockPayload = { lockKey: serialLockKey };
  let serialLockActive = false;
  const acquireSerialLock = async (): Promise<void> => {
    if (!context.enforceSerialDb) {
      return;
    }
    logBenchPhase('serial-lock', 'start', benchContext, lockPayload);
    await queryable('SELECT pg_advisory_lock($1)', [serialLockKey]);
    serialLockActive = true;
  };
  const releaseSerialLock = async (): Promise<void> => {
    if (!serialLockActive) {
      return;
    }
    try {
      await queryable('SELECT pg_advisory_unlock($1)', [serialLockKey]);
    } finally {
      serialLockActive = false;
      logBenchPhase('serial-lock', 'end', benchContext, lockPayload);
    }
  };
  const diagnostic = getCurrentTraditionalDiagnostic();
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
    applicationName,
    dbConcurrencyMode: DB_CONCURRENCY_MODE,
    workerCount: context.parallelWorkerCount ?? Math.max(1, getActiveParallelWorkers()),
    traditionalDbSerialLock: Boolean(context.enforceSerialDb),
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
  await acquireSerialLock();
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
      try {
        await releaseSerialLock();
      } catch (error) {
        console.warn('Failed to release the traditional serial lock', error);
      }
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
  scenario: Scenario,
  forceTraditionalSerial: boolean,
): Promise<RunMetrics> {
  const start = process.hrtime.bigint();
  const runStartMs = Date.now();
  const sampler = new SessionSampler();
  await sampler.start();
  const suiteSize = TRADITIONAL_CASE_COUNT * suiteMultiplier;
  const parallelWorkerCount = getActiveParallelWorkers();
  const enforceSerialDb =
    (TRADITIONAL_DB_SERIAL_LOCK || forceTraditionalSerial) &&
    scenario === 'traditional-in-process' &&
    mode === 'parallel';
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
  const metricsVariant = enforceSerialDb ? 'serial-lock' : 'parallel';
  const metricsPath = path.join(
    TMP_DIR,
    `${RUN_TAG_PREFIX}traditional-in-process-${metricsVariant}-${phase}-${mode}-${suiteMultiplier}-${runIndex}-${parallelWorkerCount}.json`,
  );
  const workerToken = `${mode}-${runIndex}`;
  const diagnostic: TraditionalParallelDiagnostic = {
    casesPerWorker: new Map<string, number>(),
    activeConnections: 0,
    peakConnections: 0,
  };
  setCurrentTraditionalDiagnostic(diagnostic);
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
      enforceSerialDb,
      serialLockKey: enforceSerialDb ? TRADITIONAL_DB_SERIAL_LOCK_KEY : undefined,
      parallelWorkerCount: Math.max(1, getActiveParallelWorkers()),
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
      traditionalDbSerialLock: enforceSerialDb,
    };
    annotateParallelWorkerCount(runMetrics, mode);
    fs.writeFileSync(metricsPath, JSON.stringify(runMetrics, null, 2), 'utf8');
    return runMetrics;
  } finally {
    const sessionSummary = await safeStopSampler(sampler);
      if (enforceSerialDb && !TRADITIONAL_DB_SERIAL_GUARD_OVERRIDE && sessionSummary.maxActiveExecuting > 2) {
      throw new Error(
        `Traditional serial mode observed ${sessionSummary.maxActiveExecuting} active executing sessions (goal <= 2). Lock waits: ${sessionSummary.maxLockWait}.`,
      );
    }
    recordSessionStat({
      scenarioLabel: 'traditional-in-process',
      mode,
      phase,
      suiteMultiplier,
      runIndex,
      workerCount: parallelWorkerCount,
      maxTotalSessions: sessionSummary.maxTotal,
      maxActiveExecutingSessions: sessionSummary.maxActiveExecuting,
      maxLockWaitSessions: sessionSummary.maxLockWait,
      sampleCount: sessionSummary.sampleCount,
    });
    clearCurrentTraditionalDiagnostic();
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
  await runCommand(pnpm, args, env, { cwd: ROOT_DIR });
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
  await runCommand(pnpm, args, env, { cwd: ROOT_DIR });
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
  await runCommand(pnpm, args, env, { cwd: ROOT_DIR });
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
  forceTraditionalSerial = false,
): Promise<RunMetrics[]> {
  const connectionModel = getActiveConnectionModel();
  const parallelWorkerCount = mode === 'parallel' ? getActiveParallelWorkers() : 1;
  const scenarioStartMs = Date.now();
  const scenarioStart = new Date(scenarioStartMs).toISOString();
  console.log(
    `[${scenarioStart}] Starting ${scenario} (${mode}, phase=${phase}, connectionModel=${connectionModel}, workers=${parallelWorkerCount}) suite x${suiteMultiplier} (${runs} runs planned).`,
  );
  const results: RunMetrics[] = [];
  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    const runStartIso = new Date().toISOString();
    // Emit per-run progress so long suites do not look stalled in the console.
    console.log(
      `[${runStartIso}] Run ${runIndex + 1}/${runs} starting: ${scenario} (${mode}, phase=${phase}, suite x${suiteMultiplier}, workers=${parallelWorkerCount}).`,
    );
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
        scenario,
        forceTraditionalSerial,
      );
    }
    logBenchProgress('run.end', runContext, {
      durationMs: runMetrics.durationMs,
    });
    const runEndIso = new Date().toISOString();
    console.log(
      `[${runEndIso}] Run ${runIndex + 1}/${runs} completed: ${scenario} (${mode}, phase=${phase}, suite x${suiteMultiplier}, workers=${parallelWorkerCount}) in ${formatMs(
        runMetrics.durationMs,
      )} ms.`,
    );
    runMetrics.runIndex = runIndex;
    runMetrics.parallelWorkerCount =
      runMetrics.mode === 'parallel' ? getActiveParallelWorkers() : 1;
    results.push(runMetrics);
    await closeDbPool();
  }
  const scenarioEndMs = Date.now();
  const scenarioEnd = new Date(scenarioEndMs).toISOString();
  console.log(
    `[${scenarioEnd}] Completed ${scenario} (${mode}, phase=${phase}, connectionModel=${connectionModel}, workers=${parallelWorkerCount}) suite x${suiteMultiplier} (${runs} runs) in ${formatMs(
      scenarioEndMs - scenarioStartMs,
    )} ms.`,
  );
  return results;
}

function enforcePerWorkerConcurrency(summary: PgConcurrencySummary): void {
  // Skip the guard when the environment requests a relaxed check for active sessions.
  if (!ENFORCE_PER_WORKER_CONCURRENCY) {
    return;
  }
  const targetWorkers = PARALLEL_WORKER_COUNTS.includes(8)
    ? 8
    : PARALLEL_WORKER_COUNTS[PARALLEL_WORKER_COUNTS.length - 1] ?? 1;
  if (targetWorkers < 8) {
    return;
  }
  const methodKey = 'ztd-bench-perworker';
  const perWorkerStats = summary.byApplication?.[methodKey];
  const dedicatedConnections = summary.distinctBackendPidsByMethod?.[methodKey] ?? 0;
  if (dedicatedConnections < targetWorkers) {
    throw new Error(
      `Per-worker concurrency target not reached: only ${dedicatedConnections} distinct PG connections for ${targetWorkers} workers (worker tags: ${Object.keys(
        summary.distinctBackendPidsByWorkerTag ?? {},
      ).join(', ')})`,
    );
  }
  const activeExecuting = perWorkerStats?.maxActiveExecutingSessions ?? 0;
  if (activeExecuting < Math.max(1, Math.floor(targetWorkers * 0.7))) {
    throw new Error(
      `Per-worker concurrency target not reached: observed ${activeExecuting} active executing sessions for ${targetWorkers} workers (>= ${
        Math.max(1, Math.floor(targetWorkers * 0.7))
      } expected).`,
    );
  }
}

async function main(): Promise<void> {
  if (ANALYSIS_ONLY) {
    await runAnalysisOnlyFromDisk();
    return;
  }

  const benchStartMs = Date.now();
  ensureDirectories();
  resetBenchmarkLog();
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
      dbConcurrencyMode: DB_CONCURRENCY_MODE,
    },
  );
  console.log(
    `Starting ZTD benchmark (profile=${BENCH_PROFILE.name}, scenarios=${BENCH_SCENARIOS.label}, log level=${REQUESTED_LOG_LEVEL}, dbConcurrency=${DB_CONCURRENCY_MODE}).`,
  );

  const container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('ztd_benchmark')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const databaseUrl = container.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;

  const concurrencyMonitor = await startPgConcurrencyMonitor({
    connectionString: databaseUrl,
    intervalMs: 500,
    outputDir: TMP_DIR,
  });
  let concurrencySummary: PgConcurrencySummary | undefined;
  let monitorStopped = false;
  const ensureMonitorStopped = async (): Promise<PgConcurrencySummary> => {
    if (monitorStopped && concurrencySummary) {
      return concurrencySummary;
    }
    concurrencySummary = await concurrencyMonitor.stop();
    monitorStopped = true;
    return concurrencySummary;
  };

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
          warmups.push(
            ...(await runScenarioMatrix({
              scenarios: runnerScenarios,
              modes: runnerModes,
              runs: runnerWarmups,
              suiteMultiplier: baselineMultiplier,
              phase: 'warmup',
              databaseUrl,
            })),
          );
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
        measured.push(
          ...(await runScenarioMatrix({
            scenarios: runnerScenarios,
            modes: runnerModes,
            runs: runnerMeasuredRuns,
            suiteMultiplier: baselineMultiplier,
            phase: 'measured',
            databaseUrl,
          })),
        );
      }

      if (BENCH_SCENARIOS.includeLowerBound) {
        const variableScenarios: Scenario[] = ['traditional-in-process', 'ztd-in-process'];
        const variableModes: ExecutionMode[] = ['serial', 'parallel'];
        for (const suiteMultiplier of suiteMultipliers) {
          const suiteSize = TRADITIONAL_CASE_COUNT * suiteMultiplier;
          const warmupRuns = shouldWarmupMultiplier(
            suiteMultiplier,
            baselineMultiplier,
            WARMUP_RUNS,
          )
            ? WARMUP_RUNS
            : 0;
          const measuredRuns = resolveMeasuredRunsForMultiplier(suiteMultiplier, MEASURED_RUNS);

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
            warmups.push(
              ...(await runScenarioMatrix({
                scenarios: variableScenarios,
                modes: variableModes,
                runs: warmupRuns,
                suiteMultiplier,
                phase: 'warmup',
                databaseUrl,
              })),
            );
            logBenchProgress(
              'bench.stage',
              {
                scenario: 'variable-cost',
                mode: 'warmup',
                suiteMultiplier,
              },
              {
                detail: `Warmup: Traditional DB serial lock (${suiteSize} tests)`,
                warmupRuns,
              },
            );
            warmups.push(
              ...(await runScenarioMatrix({
                scenarios: ['traditional-in-process'],
                modes: ['parallel'],
                runs: warmupRuns,
                suiteMultiplier,
                phase: 'warmup',
                databaseUrl,
                forceTraditionalSerial: true,
              })),
            );
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
          measured.push(
            ...(await runScenarioMatrix({
              scenarios: variableScenarios,
              modes: variableModes,
              runs: measuredRuns,
              suiteMultiplier,
              phase: 'measured',
              databaseUrl,
            })),
          );
          logBenchProgress(
            'bench.stage',
            {
              scenario: 'variable-cost',
              mode: 'measured',
              suiteMultiplier,
            },
            {
              detail: `Measured: Traditional DB serial lock (${suiteSize} tests)`,
              measuredRuns,
            },
          );
          measured.push(
            ...(await runScenarioMatrix({
              scenarios: ['traditional-in-process'],
              modes: ['parallel'],
              runs: measuredRuns,
              suiteMultiplier,
              phase: 'measured',
              databaseUrl,
              forceTraditionalSerial: true,
            })),
          );
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
            ...(await runScenarioMatrix({
              scenarios: ['traditional-steady-state', 'ztd-steady-state'],
              modes: ['serial'],
              runs: steadyStateWarmups,
              suiteMultiplier: steadyStateSuiteMultiplier,
              phase: 'warmup',
              databaseUrl,
            })),
          );
          warmups.push(
            ...(await runScenarioMatrix({
              scenarios: ['ztd-steady-state'],
              modes: ['parallel'],
              runs: steadyStateWarmups,
              suiteMultiplier: steadyStateSuiteMultiplier,
              phase: 'warmup',
              databaseUrl,
            })),
          );
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
          ...(await runScenarioMatrix({
            scenarios: ['traditional-steady-state', 'ztd-steady-state'],
            modes: ['serial'],
            runs: steadyStateMeasuredRuns,
            suiteMultiplier: steadyStateSuiteMultiplier,
            phase: 'measured',
            databaseUrl,
          })),
        );
        measured.push(
          ...(await runScenarioMatrix({
            scenarios: ['ztd-steady-state'],
            modes: ['parallel'],
            runs: steadyStateMeasuredRuns,
            suiteMultiplier: steadyStateSuiteMultiplier,
            phase: 'measured',
            databaseUrl,
          })),
        );
      }
    }

    const postgresVersion = await fetchPostgresVersion(databaseUrl);
    const recordedRuns = loadRunMetricsFromDisk(TMP_DIR, RUN_TAG_PREFIX);
    const currentSessionStats = getSessionStats();
    const persistedSessionStats = loadPersistedSessionStats(TMP_DIR, RUN_TAG_PREFIX);
    const aggregatedSessionStats = [...persistedSessionStats, ...currentSessionStats];
    clearSessionStats();
    appendSessionStats(aggregatedSessionStats);
    const totalBenchmarkDurationMs = Date.now() - benchStartMs;
    const concurrencySummaryResult = await ensureMonitorStopped();
    writeReportMetadata(REPORT_METADATA_PATH, {
      metadataVersion: 1,
      databaseInfo: postgresVersion,
      suiteMultipliers,
      steadyStateSuiteMultiplier,
      totalBenchmarkDurationMs,
      benchProfileName: BENCH_PROFILE.name,
      benchScenarios: BENCH_SCENARIOS,
      warmupRuns: WARMUP_RUNS,
      measuredRuns: MEASURED_RUNS,
      steadyStateWarmups: STEADY_STATE_WARMUPS,
      steadyStateMeasuredRuns: STEADY_STATE_MEASURED_RUNS,
      parallelWorkerCounts: PARALLEL_WORKER_COUNTS,
      benchConnectionModels: BENCH_CONNECTION_MODELS,
      traditionalDbSerialLock: TRADITIONAL_DB_SERIAL_LOCK,
      reportPath: REPORT_PATH,
      appendixReportPath: APPENDIX_REPORT_PATH,
      rootDir: ROOT_DIR,
      runTagPrefix: RUN_TAG_PREFIX,
    });
    // TODO: Emit a run-tagged report metadata file to avoid overwriting when multiple run tags are used.
    writeBenchmarkReports({
      results: recordedRuns,
      databaseInfo: postgresVersion,
      suiteMultipliers,
      steadyStateSuiteMultiplier,
      totalBenchmarkDurationMs,
      concurrencySummary: concurrencySummaryResult,
      benchProfileName: BENCH_PROFILE.name,
      benchScenarios: BENCH_SCENARIOS,
      warmupRuns: WARMUP_RUNS,
      measuredRuns: MEASURED_RUNS,
      steadyStateWarmups: STEADY_STATE_WARMUPS,
      steadyStateMeasuredRuns: STEADY_STATE_MEASURED_RUNS,
      parallelWorkerCounts: PARALLEL_WORKER_COUNTS,
      benchConnectionModels: BENCH_CONNECTION_MODELS,
      traditionalDbSerialLock: TRADITIONAL_DB_SERIAL_LOCK,
      reportPath: REPORT_PATH,
      appendixReportPath: APPENDIX_REPORT_PATH,
      rootDir: ROOT_DIR,
    });
    const currentConnectionEvents = getConnectionEvents();
    persistConnectionEventsToDisk({
      tmpDir: TMP_DIR,
      runTagPrefix: RUN_TAG_PREFIX,
      events: currentConnectionEvents,
    });
    persistSessionStatsToDisk({
      tmpDir: TMP_DIR,
      runTagPrefix: RUN_TAG_PREFIX,
      stats: currentSessionStats,
    });
    if (DB_CONCURRENCY_MODE === 'perWorker') {
      enforcePerWorkerConcurrency(concurrencySummaryResult);
    }

    logBenchProgress(
      'bench.end',
      {},
      {
        detail: 'Benchmark run complete',
        warmupRuns: warmups.length,
        measuredRuns: measured.length,
        reportPath: path.relative(ROOT_DIR, REPORT_PATH),
        appendixReportPath: path.relative(ROOT_DIR, APPENDIX_REPORT_PATH),
        logPath: path.relative(ROOT_DIR, BENCH_LOG_PATH),
        totalDurationMs: totalBenchmarkDurationMs,
      },
    );
    console.log(
      `ZTD benchmark complete (warmups: ${warmups.length}, measured: ${measured.length}). Report: ${path.relative(
        ROOT_DIR,
        REPORT_PATH,
      )}; appendix: ${path.relative(ROOT_DIR, APPENDIX_REPORT_PATH)}; log: ${path.relative(
        ROOT_DIR,
        BENCH_LOG_PATH,
      )}.`,
    );
  } finally {
    // Ensure the benchmark log stream flushes before closing database resources.
    closeBenchmarkLogger();
    await ensureMonitorStopped().catch(() => {});
    // Tear down the shared pool before stopping the container so connections cleanly release.
    await closeDbPool();
    await container.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
