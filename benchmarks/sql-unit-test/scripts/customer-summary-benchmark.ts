import { performance } from 'node:perf_hooks';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import {
  disposeSharedClient,
  type ZtdExecutionMode,
  type ZtdSqlLogEvent,
  type ZtdSqlLogOptions,
} from '../tests/support/testkit-client';
import {
  runCustomerSummaryScenario,
  type CustomerSummaryScenarioOptions,
  type ScenarioInstrumentation,
} from '../tests/scenarios/customerSummaryScenario';
import {
  REPORT_FILE_PATH,
  RESULTS_JSON_PATH,
  TEST_COUNTS,
  REPEAT_ITERATIONS,
  PARALLEL_WORKERS,
  CONNECTION_PROFILES,
  ConnectionProfile,
  StageLogEntry,
  StageBreakdownRow,
  LogSamples,
  COST_LOG_PATH,
  STAGE_ORDER,
  MeasurementRow,
  MeasurementStats,
} from './benchmark-config';
import { buildReportContent } from './report-builder';
const PG_SHUTDOWN_CODE = '57P01';
const sqlLogSamples: LogSamples = {};
const stageAggregates = new Map<
  string,
  { stageSums: Record<string, number>; iterationCount: number }
>();

async function logStageDurations(details: StageLogEntry): Promise<void> {
  const payload = { timestamp: new Date().toISOString(), ...details };
  await appendFile(COST_LOG_PATH, safeJsonStringify(payload) + '\n');
}

function aggregateStageDurations(
  mode: ZtdExecutionMode,
  connectionProfile: ConnectionProfile,
  testCount: number,
  parallel: number,
  stageDurations: Record<string, number>,
): void {
  const key = `${mode}|${connectionProfile}|${testCount}|${parallel}`;
  const existing = stageAggregates.get(key);
  const entry = existing ?? { stageSums: {}, iterationCount: 0 };
  for (const stage of STAGE_ORDER) {
    entry.stageSums[stage] = (entry.stageSums[stage] ?? 0) + (stageDurations[stage] ?? 0);
  }
  entry.iterationCount += 1;
  stageAggregates.set(key, entry);
}

function buildStageBreakdownRows(): StageBreakdownRow[] {
  const rows: StageBreakdownRow[] = [];
  for (const [key, aggregate] of stageAggregates.entries()) {
    const [mode, connectionProfile, testCountStr, parallelStr] = key.split('|');
    if (!mode || !connectionProfile || !testCountStr || !parallelStr) {
      continue;
    }
    const iterationCount = aggregate.iterationCount || 1;
    const stageMeans: Record<string, number> = {};
    let totalMean = 0;
    for (const stage of STAGE_ORDER) {
      const mean = (aggregate.stageSums[stage] ?? 0) / iterationCount;
      stageMeans[stage] = mean;
      totalMean += mean;
    }
    rows.push({
      mode: mode as ZtdExecutionMode,
      connectionProfile: connectionProfile as ConnectionProfile,
      testCount: Number(testCountStr),
      parallel: Number(parallelStr),
      stageMeans,
      totalMean,
    });
  }
  return rows.sort((a, b) => {
    if (a.mode !== b.mode) {
      return a.mode.localeCompare(b.mode);
    }
    if (a.testCount !== b.testCount) {
      return a.testCount - b.testCount;
    }
    if (a.parallel !== b.parallel) {
      return a.parallel - b.parallel;
    }
    return a.connectionProfile.localeCompare(b.connectionProfile);
  });
}

function collectSqlLogSamples(events: ZtdSqlLogEvent[], mode: ZtdExecutionMode) {
  for (const event of events) {
    if (mode === 'ztd') {
      if (event.phase === 'original' && !sqlLogSamples.ztdOriginal) {
        sqlLogSamples.ztdOriginal = event.sql.trim();
      }
      if (event.phase === 'rewritten' && !sqlLogSamples.ztdRewritten) {
        sqlLogSamples.ztdRewritten = event.sql.trim();
      }
    } else if (mode === 'traditional') {
      if (event.phase === 'original' && !sqlLogSamples.traditionalOriginal) {
        sqlLogSamples.traditionalOriginal = event.sql.trim();
      }
    }
  }
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') {
      return item.toString();
    }

    if (typeof item === 'object' && item !== null) {
      if (seen.has(item)) {
        return '[Circular]';
      }
      seen.add(item);
    }
    return item;
  });
}

/** Guard the benchmark runner against the Postgres shutdown signal emitted during container cleanup. */
function isPgShutdownError(value: unknown): value is { code?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    (value as { code?: string }).code === PG_SHUTDOWN_CODE
  );
}

function isConnectionTermination(value: unknown): value is { message?: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const message = (value as { message?: string }).message;
  return typeof message === 'string' && message.includes('Connection terminated unexpectedly');
}

process.on('uncaughtException', (error) => {
  if (isPgShutdownError(error) || isConnectionTermination(error)) {
    console.warn('Ignoring Postgres shutdown error during cleanup.', error);
    return;
  }
  throw error;
});

process.on('unhandledRejection', (reason) => {
  if (isPgShutdownError(reason) || isConnectionTermination(reason)) {
    console.warn('Ignoring Postgres shutdown rejection during cleanup.', reason);
    return;
  }
  throw reason;
});

async function runSingleIteration(
  mode: ZtdExecutionMode,
  connectionProfile: ConnectionProfile,
  testCount: number,
  repetition: number,
  parallel: number,
): Promise<number> {
  const isPerTest = connectionProfile === 'perTest';
  const logEvents: ZtdSqlLogEvent[] = [];
  const stageDurations: Record<string, number> = {};
  const logSqlToConsole = isTruthyEnv(process.env.ZTD_SQL_LOG);
  const instrumentation: ScenarioInstrumentation = {
    recordStage(stage, durationMs) {
      stageDurations[stage] = (stageDurations[stage] ?? 0) + durationMs;
    },
  };

  const options: CustomerSummaryScenarioOptions = {
    exclusiveConnection: isPerTest,
    cleanupStrategy: 'rollback',
    enabled: true,
    logger: (event) => {
      logEvents.push(event);
      if (logSqlToConsole) {
        console.log(safeJsonStringify(event));
      }
    },
    profile: {
      enabled: true,
      perQuery: true,
      logger: () => {
        return;
      },
    },
  };
  if (mode === 'ztd') {
    options.dangerousSqlPolicy = 'off';
  }

  const start = performance.now();
  await runCustomerSummaryScenario(mode, options, instrumentation);
  collectSqlLogSamples(logEvents, mode);
  const duration = performance.now() - start;
  await logStageDurations({
    mode,
    connectionProfile,
    testCount,
    parallel,
    repetition,
    durationMs: duration,
    stageDurations,
  });
  aggregateStageDurations(mode, connectionProfile, testCount, parallel, stageDurations);
  return duration;
}

async function collectDurations(
  mode: ZtdExecutionMode,
  testCount: number,
  parallel: number,
  connectionProfile: ConnectionProfile,
  repetition: number,
): Promise<number[]> {
  const samples = new Array<number>(testCount);
  let nextIndex = 0;

  const workerCount = Math.min(parallel, testCount);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const iteration = nextIndex++;
      if (iteration >= testCount) {
        break;
      }
      samples[iteration] = await runSingleIteration(mode, connectionProfile, testCount, repetition, parallel);
    }
  });

  await Promise.all(workers);
  return samples;
}

function summarize(samples: number[]): MeasurementStats {
  const count = samples.length;
  const meanTotalMs = samples.reduce((total, value) => total + value, 0) / count;
  const variance =
    samples.reduce((total, value) => total + Math.pow(value - meanTotalMs, 2), 0) / Math.max(1, count - 1);
  const stdDevTotalMs = Math.sqrt(variance);
  const errorTotalMs = stdDevTotalMs / Math.sqrt(count);
  return { meanTotalMs, errorTotalMs, stdDevTotalMs };
}



async function main(): Promise<void> {
  await mkdir('tmp', { recursive: true });
  await writeFile(COST_LOG_PATH, '', 'utf8');
  const container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('ztd_playground_bench')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  process.env.DATABASE_URL = container.getConnectionUri();

  const measurements: MeasurementRow[] = [];

  try {
    for (const testCount of TEST_COUNTS) {
      for (const parallel of PARALLEL_WORKERS) {
        for (const connectionProfile of CONNECTION_PROFILES) {
          for (const mode of ['ztd', 'traditional'] as const) {
            const totalTimes: number[] = [];
            for (let repetition = 1; repetition <= REPEAT_ITERATIONS; repetition++) {
              console.log(
                `Measuring mode=${mode} connection=${connectionProfile} `
                  + `tests=${testCount} repetition=${repetition} parallel=${parallel} ...`,
              );
              const durations = await collectDurations(mode, testCount, parallel, connectionProfile, repetition);
              const totalMs = durations.reduce((sum, value) => sum + value, 0);
              totalTimes.push(totalMs);
              console.log('  done');
            }
            const stats = summarize(totalTimes);
            measurements.push({ mode, testCount, parallel, connectionProfile, stats });
          }
        }
      }
    }
    await writeFile(RESULTS_JSON_PATH, JSON.stringify(measurements, null, 2));  

    const stageBreakdownRows = buildStageBreakdownRows();
    const reportContent = await buildReportContent(measurements, stageBreakdownRows, sqlLogSamples);
    await writeFile(REPORT_FILE_PATH, reportContent);
    console.log(`Report written to ${REPORT_FILE_PATH}`);
  } finally {
    // Close the shared pg.Client before stopping the container to avoid Postgres emitting fatal shutdown notices.
    try {
      await disposeSharedClient();
    } catch (disposeError) {
      console.warn('Failed to dispose shared pg client:', disposeError);
    }
    try {
      await container.stop();
    } catch (stopError) {
      console.warn('Failed to stop PostgreSQL container:', stopError);
    }
  }
}

main().catch((error) => {
  console.error('Benchmark failed', error);
  process.exit(1);
});
