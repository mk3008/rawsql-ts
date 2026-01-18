import fs from 'node:fs';
import path from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { closeDbPool } from './support/db-client';
import { buildBenchSchemaName } from './ztd-bench-vs-raw/tests/support/bench-suite';
import type { BenchCaseName } from './ztd-bench-vs-raw/tests/support/bench-repository';
import {
  runCustomerSummaryCase,
  runProductRankingCase,
  runSalesSummaryCase,
} from './ztd-bench-vs-raw/tests/support/ztd-bench-cases';
import type { ZtdBenchCaseOptions } from './ztd-bench-vs-raw/tests/support/ztd-bench-cases';
import type {
  ZtdBenchMetrics,
  ZtdExecutionMode,
} from './ztd-bench-vs-raw/tests/support/testkit-client';
import { average, stddev, formatMs } from './bench-runner/utils';

type CaseRunner = {
  caseName: BenchCaseName;
  runner: (options: ZtdBenchCaseOptions) => Promise<void>;
};

type CaseRunResult = {
  mode: ZtdExecutionMode;
  caseName: BenchCaseName;
  durationMs: number;
  metrics: ZtdBenchMetrics;
  iteration: number;
};

const CASE_RUNNERS: CaseRunner[] = [
  { caseName: 'customer-summary', runner: runCustomerSummaryCase },
  { caseName: 'product-ranking', runner: runProductRankingCase },
  { caseName: 'sales-summary', runner: runSalesSummaryCase },
];

const MODES: ZtdExecutionMode[] = ['ztd', 'traditional'];
const WARMUP_RUNS = Math.max(
  0,
  resolveNumberEnv(
    ['TESTKIT_POSTGRES_MODE_BENCH_WARMUP', 'PG_TESTKIT_MODE_BENCH_WARMUP'],
    1
  )
);
const MEASURED_RUNS = Math.max(
  1,
  resolveNumberEnv(
    ['TESTKIT_POSTGRES_MODE_BENCH_RUNS', 'PG_TESTKIT_MODE_BENCH_RUNS'],
    5
  )
);
const REPORT_PATH =
  process.env.TESTKIT_POSTGRES_MODE_BENCH_REPORT_PATH ??
  process.env.PG_TESTKIT_MODE_BENCH_REPORT_PATH ??
  path.join('tmp', 'testkit-postgres-mode-report.md');

async function main(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('ztd_pg_testkit_mode')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();
  process.env.DATABASE_URL = container.getConnectionUri();

  try {
    const measuredResults: CaseRunResult[] = [];

    for (const mode of MODES) {
    console.log(`Running testkit-postgres mode benchmark: ${mode} (warmups=${WARMUP_RUNS}, measured=${MEASURED_RUNS})`);
      await runWarmups(mode);
      const modeResults = await runMeasuredRuns(mode);
      measuredResults.push(...modeResults);
    }

    const report = buildReport(measuredResults);
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, report, 'utf8');
    console.log(`testkit-postgres mode comparison report written to ${REPORT_PATH}`);
    console.log(report);
  } finally {
    await closeDbPool();
    await container.stop();
  }
}

async function runWarmups(mode: ZtdExecutionMode): Promise<void> {
  for (let iteration = 0; iteration < WARMUP_RUNS; iteration += 1) {
    await runAllCases(mode, iteration, 'warmup');
  }
}

async function runMeasuredRuns(mode: ZtdExecutionMode): Promise<CaseRunResult[]> {
  const results: CaseRunResult[] = [];
  for (let iteration = 0; iteration < MEASURED_RUNS; iteration += 1) {
    const runs = await runAllCasesWithMetrics(mode, iteration);
    results.push(...runs);
  }
  return results;
}

async function runAllCases(mode: ZtdExecutionMode, iteration: number, phase: 'warmup' | 'measured'): Promise<void> {
  for (const caseRunner of CASE_RUNNERS) {
    await caseRunner.runner({
      schemaName: buildBenchSchemaName(`${caseRunner.caseName}-${mode}`, `${phase}-${iteration}`),
      executionMode: mode,
      scenarioLabel: `testkit-postgres-${mode}`,
      mode: 'serial',
      phase,
      workerId: `${mode}-warmup-${iteration}`,
      caseName: caseRunner.caseName,
      suiteMultiplier: 1,
      runIndex: iteration,
      parallelWorkerCount: 1,
    });
  }
}

async function runAllCasesWithMetrics(mode: ZtdExecutionMode, iteration: number): Promise<CaseRunResult[]> {
  const results: CaseRunResult[] = [];
  for (const caseRunner of CASE_RUNNERS) {
    let collectedMetrics: ZtdBenchMetrics | undefined;
    const start = Date.now();
    await caseRunner.runner({
      schemaName: buildBenchSchemaName(`${caseRunner.caseName}-${mode}`, `run-${iteration}`),
      executionMode: mode,
      scenarioLabel: `testkit-postgres-${mode}`,
      mode: 'serial',
      phase: 'measured',
      workerId: `${mode}-run-${iteration}`,
      caseName: caseRunner.caseName,
      suiteMultiplier: 1,
      runIndex: iteration,
      parallelWorkerCount: 1,
      metricsCollector: (metrics) => {
        collectedMetrics = { ...metrics };
      },
    });
    const durationMs = Date.now() - start;
    results.push({
      mode,
      caseName: caseRunner.caseName,
      durationMs,
      metrics: collectedMetrics ?? createEmptyMetrics(),
      iteration,
    });
  }
  return results;
}

function buildReport(results: CaseRunResult[]): string {
  const grouped = new Map<string, CaseRunResult[]>();
  for (const result of results) {
    const key = `${result.mode}:${result.caseName}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(result);
    grouped.set(key, bucket);
  }

  const rows: string[] = [];
  for (const [key, bucket] of grouped) {
    const [mode, caseName] = key.split(':') as [ZtdExecutionMode, BenchCaseName];
    const durations = bucket.map((entry) => entry.durationMs);
    const durationAvg = average(durations);
    const durationStd = stddev(durations);
    const metricKeys: Array<keyof ZtdBenchMetrics> = [
      'sqlCount',
      'totalDbMs',
      'rewriteMs',
      'fixtureMaterializationMs',
      'sqlGenerationMs',
      'otherProcessingMs',
      'migrationMs',
      'cleanupMs',
    ];
    const metricAverages = new Map<string, number>();
    for (const key of metricKeys) {
      const values = bucket.map((entry) => (typeof entry.metrics[key] === 'number' ? entry.metrics[key]! : 0));
      metricAverages.set(key, average(values));
    }

    rows.push(
      `| ${mode} | ${caseName} | ${bucket.length} | ${formatMs(durationAvg)} | ${formatMs(durationStd)} | ${metricAverages
        .get('sqlCount')
        ?.toFixed(2)} | ${formatMs(metricAverages.get('totalDbMs') ?? 0)} | ${formatMs(
        metricAverages.get('migrationMs') ?? 0,
      )} | ${formatMs(metricAverages.get('cleanupMs') ?? 0)} |`,
    );
  }

  const header = [
    '# testkit-postgres Mode Comparison',
    '',
    `- Measured suites: ${MEASURED_RUNS} repetitions per mode/case`,
    `- Warmup suites: ${WARMUP_RUNS} repetitions discarded at the start`,
    '',
    '| Mode | Case | Runs | Avg Duration (ms) | Duration StdDev (ms) | Avg SQL Count | Avg DB ms | Avg Migration (ms) | Avg Cleanup ms |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  const reportBody = [...header, ...rows].join('\n');
  const footer = [
    '',
    '## Reproducing',
    '',
    '```bash',
    'pnpm ztd:bench:testkit-postgres-mode',
    '```',
    '',
    'This benchmark spikes both the testkit-postgres ZTD rewrite path and the traditional DDL/seeding path to highlight where the time is spent.',
  ].join('\n');

  return `${reportBody}\n${footer}`;
}

function resolveNumberEnv(keys: string | string[], fallback: number): number {
  const candidates = Array.isArray(keys) ? keys : [keys];
  for (const key of candidates) {
    if (!(key in process.env)) {
      continue;
    }

    const raw = Number(process.env[key]);
    if (!Number.isFinite(raw)) {
      continue;
    }

    return Math.max(0, Math.floor(raw));
  }

  return fallback;
}

function createEmptyMetrics(): ZtdBenchMetrics {
  return {
    sqlCount: 0,
    totalDbMs: 0,
    totalQueryMs: 0,
    rewriteMs: 0,
    fixtureMaterializationMs: 0,
    sqlGenerationMs: 0,
    otherProcessingMs: 0,
    migrationMs: 0,
    cleanupMs: 0,
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
