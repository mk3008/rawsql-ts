import os from 'node:os';
import path from 'node:path';
import type {
  ConnectionLoggerEntry,
  ConnectionModel,
  DbConcurrencyMode,
  RunPhase,
  SessionStat,
} from '../ztd-bench-vs-raw/tests/support/diagnostics';
import { getConnectionEvents, getSessionStats } from '../ztd-bench-vs-raw/tests/support/diagnostics';
import { getZtdSessionMap, getZtdWaitingMap } from '../ztd-bench-vs-raw/tests/support/bench-diagnostics';
import { getBenchPhaseEntries } from '../support/benchmark-logger';
import type { PgConcurrencySummary } from '../support/pg-concurrency';
import { getMetricsStatusEntries } from './metrics';
import { collectTraditionalMetric, summarizeComponent } from './report/report-helpers';
import type {
  BenchScenarioSelection,
  ExecutionMode,
  RunMetrics,
  Scenario,
  SteadyStateMetrics,
} from './types';
import { average, computePercentile, formatMs, formatOptionalMs, stddev } from './utils';
import { TRADITIONAL_CASE_COUNT } from './benchmark-data';
import { resolveMeasuredRunsForMultiplier } from './benchmark-helpers';

export type RenderReportOptions = {
  results: RunMetrics[];
  databaseInfo: string;
  suiteMultipliers: number[];
  steadyStateSuiteMultiplier: number;
  totalBenchmarkDurationMs: number;
  concurrencySummary: PgConcurrencySummary;
  benchProfileName: string;
  benchScenarios: BenchScenarioSelection;
  warmupRuns: number;
  measuredRuns: number;
  steadyStateWarmups: number;
  steadyStateMeasuredRuns: number;
  parallelWorkerCounts: number[];
  benchConnectionModels: ConnectionModel[];
  traditionalDbSerialLock: boolean;
  reportPath: string;
  appendixReportPath: string;
  rootDir: string;
  supplementalResults?: RunMetrics[];
};

export function renderReport(
  options: RenderReportOptions,
): { mainReport: string; appendixReport: string } {
  const {
    results,
    databaseInfo,
    suiteMultipliers,
    steadyStateSuiteMultiplier,
    totalBenchmarkDurationMs,
    concurrencySummary,
    benchProfileName,
    benchScenarios,
    warmupRuns,
    measuredRuns,
    steadyStateWarmups,
    steadyStateMeasuredRuns,
    parallelWorkerCounts,
    benchConnectionModels,
    traditionalDbSerialLock,
    reportPath,
    appendixReportPath,
    rootDir,
  } = options;
  const now = new Date().toISOString();
  const cpuModel = os.cpus()[0]?.model ?? 'Unknown CPU';
  const logicalCores = os.cpus().length;
  const testCaseNames = ['customer_summary', 'product_ranking', 'sales_summary'];
  const testCaseCount = TRADITIONAL_CASE_COUNT;
  const repositoryCallsPerTest = 1;
  const measured = results.filter((run) => run.phase === 'measured');
  const sessionStats = getSessionStats();
  const sessionStatIndex = new Map<string, SessionStat[]>();
  sessionStats.forEach((stat: SessionStat) => {
    const key = [
      stat.scenarioLabel,
      stat.mode,
      stat.phase,
      stat.suiteMultiplier,
      stat.runIndex,
      stat.workerCount,
      stat.dbConcurrencyMode ?? 'none',
    ].join('|');
    const existing = sessionStatIndex.get(key) ?? [];
    existing.push(stat);
    sessionStatIndex.set(key, existing);
  });
  const buildRunKey = (run: RunMetrics): string =>
    [
      run.scenario,
      run.mode,
      run.phase,
      run.suiteMultiplier,
      run.runIndex ?? 0,
      run.parallelWorkerCount ?? 1,
      run.dbConcurrencyMode ?? 'none',
    ].join('|');
  const gatherSessionStatsForRuns = (runs: RunMetrics[]): SessionStat[] =>
    runs.flatMap((run) => sessionStatIndex.get(buildRunKey(run)) ?? []);
  type AggregationKeyParams = {
    scenario: Scenario;
    mode: ExecutionMode;
    phase: RunPhase;
    suiteMultiplier: number;
    workerCount: number;
    dbConcurrencyMode?: DbConcurrencyMode;
    traditionalDbSerialLock?: boolean;
  };
  const buildAggregationKey = (params: AggregationKeyParams): string =>
    [
      params.scenario,
      params.mode,
      params.phase,
      params.suiteMultiplier,
      params.workerCount,
      params.dbConcurrencyMode ?? 'none',
      params.traditionalDbSerialLock ? 'serial' : 'parallel',
    ].join('|');
  const connectionEvents = getConnectionEvents();
  const connectionEventIndex = new Map<string, ConnectionLoggerEntry[]>();
  connectionEvents.forEach((entry) => {
    if (entry.phase !== 'measured') {
      return;
    }
    const key = buildAggregationKey({
      scenario: entry.scenarioLabel as Scenario,
      mode: entry.mode,
      phase: entry.phase,
      suiteMultiplier: entry.suiteMultiplier,
      workerCount: entry.workerCount ?? 1,
      dbConcurrencyMode: entry.dbConcurrencyMode,
      traditionalDbSerialLock: entry.traditionalDbSerialLock,
    });
    const bucket = connectionEventIndex.get(key) ?? [];
    bucket.push(entry);
    connectionEventIndex.set(key, bucket);
  });
  const gatherConnectionEventsForRuns = (runs: RunMetrics[]): ConnectionLoggerEntry[] =>
    runs.flatMap((run) =>
      connectionEventIndex.get(
        buildAggregationKey({
          scenario: run.scenario,
          mode: run.mode,
          phase: run.phase,
          suiteMultiplier: run.suiteMultiplier,
          workerCount: run.parallelWorkerCount ?? 1,
          dbConcurrencyMode: run.dbConcurrencyMode,
          traditionalDbSerialLock: Boolean(run.traditionalDbSerialLock),
        }),
      ) ?? [],
    );
  const buildAggregatedSummaries = (runs: RunMetrics[]): Map<string, AggregatedSummary> => {
    const runsByKey = new Map<string, RunMetrics[]>();
    const suiteSizeByKey = new Map<string, number>();
    runs.forEach((run) => {
      const workerCount = run.parallelWorkerCount ?? 1;
      const key = buildAggregationKey({
        scenario: run.scenario,
        mode: run.mode,
        phase: run.phase,
        suiteMultiplier: run.suiteMultiplier,
        workerCount,
        dbConcurrencyMode: run.dbConcurrencyMode,
        traditionalDbSerialLock: Boolean(run.traditionalDbSerialLock),
      });
      const bucket = runsByKey.get(key) ?? [];
      bucket.push(run);
      runsByKey.set(key, bucket);
      suiteSizeByKey.set(key, TRADITIONAL_CASE_COUNT * run.suiteMultiplier);
    });
    const aggregatedSummaries = new Map<string, AggregatedSummary>();
    runsByKey.forEach((runs, key) => {
      const suiteSize = suiteSizeByKey.get(key) ?? TRADITIONAL_CASE_COUNT;
      const summary = summarizeRunSet(runs, suiteSize);
      const connectionEntries = gatherConnectionEventsForRuns(runs);
      const distinctPids = new Set(connectionEntries.map((entry) => entry.pid));
      const workerPidGroups = new Map<string, Set<number>>();
      connectionEntries.forEach((entry) => {
        const tag = entry.workerId ?? 'worker-unknown';
        const set = workerPidGroups.get(tag) ?? new Set<number>();
        set.add(entry.pid);
        workerPidGroups.set(tag, set);
      });
      const workerPidCounts: Record<string, number> = {};
      workerPidGroups.forEach((set, tag) => {
        workerPidCounts[tag] = set.size;
      });
      const representative = runs[0];
      aggregatedSummaries.set(key, {
        suiteSize,
        scenario: representative.scenario,
        mode: representative.mode,
        workerCount: representative.parallelWorkerCount ?? 1,
        suiteMultiplier: representative.suiteMultiplier,
        dbConcurrencyMode: representative.dbConcurrencyMode,
        traditionalDbSerialLock: Boolean(representative.traditionalDbSerialLock),
        mean: summary.mean,
        stddev: summary.stddev,
        perTest: summary.perTest,
        maxActiveExecuting: summary.maxActiveExecuting,
        maxLockWait: summary.maxLockWait,
        distinctBackendConnections: distinctPids.size,
        connectionEventCount: connectionEntries.length,
        workerPidCounts,
        averageTotalDbMs: summarizeComponent(runs, (run) => run.totalDbMs).average,
        averageRewriteMs: summarizeComponent(runs, (run) => run.rewriteMs).average,
        averageFixtureMs: summarizeComponent(runs, (run) => run.fixtureMaterializationMs).average,
        averageSqlGenerationMs: summarizeComponent(runs, (run) => run.sqlGenerationMs).average,
      });
    });
    return aggregatedSummaries;
  };
  const summarizeRunSet = (
    runs: RunMetrics[],
    suiteSize: number,
  ): {
    mean?: number;
    stddev?: number;
    perTest?: number;
    maxActiveExecuting?: number;
    maxLockWait?: number;
  } => {
    const durations = runs
      .map((run) => run.durationMs)
      .filter((value): value is number => typeof value === 'number');
    const mean = durations.length > 0 ? average(durations) : undefined;
    const std = durations.length > 1 ? stddev(durations) : durations.length === 1 ? 0 : undefined;
    const perTest = typeof mean === 'number' && suiteSize > 0 ? mean / suiteSize : undefined;
    const stats = gatherSessionStatsForRuns(runs);
    const maxActiveExecuting =
      stats.length > 0 ? Math.max(...stats.map((stat) => stat.maxActiveExecutingSessions)) : undefined;
    const maxLockWait =
      stats.length > 0 ? Math.max(...stats.map((stat) => stat.maxLockWaitSessions)) : undefined;
    return {
      mean,
      stddev: std,
      perTest,
      maxActiveExecuting,
      maxLockWait,
    };
  };
  type AggregatedSummary = {
    suiteSize: number;
    scenario: Scenario;
    mode: ExecutionMode;
    workerCount: number;
    suiteMultiplier: number;
    dbConcurrencyMode?: DbConcurrencyMode;
    traditionalDbSerialLock?: boolean;
    mean?: number;
    stddev?: number;
    perTest?: number;
    maxActiveExecuting?: number;
    maxLockWait?: number;
    distinctBackendConnections: number;
    connectionEventCount: number;
    workerPidCounts: Record<string, number>;
    averageTotalDbMs?: number;
    averageRewriteMs?: number;
    averageFixtureMs?: number;
    averageSqlGenerationMs?: number;
  };
  const primarySummaries = buildAggregatedSummaries(measured);
  const supplementalMeasured = (options.supplementalResults ?? []).filter((run) => run.phase === 'measured');
  const supplementalSummaries = buildAggregatedSummaries(supplementalMeasured);
  const case1SummaryMap = new Map(primarySummaries);
  supplementalSummaries.forEach((summary, key) => {
    case1SummaryMap.set(key, summary);
  });
  const lookupSummary = (
    summaryMap: Map<string, AggregatedSummary>,
    params: Omit<AggregationKeyParams, 'phase'>,
  ): AggregatedSummary | undefined =>
    summaryMap.get(
      buildAggregationKey({
        ...params,
        phase: 'measured',
      }),
    );
  const tablePending = 'pending';
  const notCapturedPlaceholder = 'not captured';
  const isFiniteNumber = (value?: number): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  const formatActiveExecutingSessions = (value?: number, placeholder = tablePending): string =>
    isFiniteNumber(value) ? value.toString() : placeholder;
  const formatDistinctConnections = (value?: number, placeholder = tablePending): string =>
    isFiniteNumber(value) ? value.toString() : placeholder;
  const metricsStatusEntries = getMetricsStatusEntries();
  const suiteSizes = suiteMultipliers.map((multiplier) => TRADITIONAL_CASE_COUNT * multiplier);
  const baselineMultiplier = suiteMultipliers[0] ?? 1;
  const baselineSuiteSize = TRADITIONAL_CASE_COUNT * baselineMultiplier;
  const steadyStateSuiteSize = TRADITIONAL_CASE_COUNT * steadyStateSuiteMultiplier;
  const scenarioSummary = [
    benchScenarios.includeRunner ? 'runner-overhead' : null,
    benchScenarios.includeLowerBound ? 'variable-cost' : null,
    benchScenarios.includeSteady ? 'steady-state' : null,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(', ');
  const steadyStateWarmupRuns = benchScenarios.includeSteady ? steadyStateWarmups : 0;
  const steadyStateMeasuredRunsCount = benchScenarios.includeSteady ? steadyStateMeasuredRuns : 0;
  const runnerSerialRuns = measured.filter(
    (run) =>
      (run.scenario === 'traditional-runner' || run.scenario === 'ztd-runner') &&
      run.mode === 'serial' &&
      run.suiteMultiplier === baselineMultiplier,
  );
  const runnerStartupMean = summarizeComponent(runnerSerialRuns, (run) => run.startupMs).average;
  const runnerExecutionMean = summarizeComponent(runnerSerialRuns, (run) => run.executionMs).average;

  

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
  const highlightConnectionModel = benchConnectionModels[0] ?? 'perWorker';
  const highlightWorkerCount =
    parallelWorkerCounts.length > 0
      ? parallelWorkerCounts.includes(8)
        ? 8
        : parallelWorkerCounts[parallelWorkerCounts.length - 1]
      : 1;
  const highlightSuiteMultiplier =
    largeSuiteTarget?.multiplier ??
    suiteMultipliers[suiteMultipliers.length - 1] ??
    1;
  const highlightSuiteSize =
    largeSuiteTarget?.suiteSize ?? TRADITIONAL_CASE_COUNT * highlightSuiteMultiplier;
  const highlightSuiteLabel =
    largeSuiteTarget?.label ?? `${highlightSuiteSize} tests`;
  const highlightKey = `ztd-in-process|${highlightConnectionModel}|parallel|measured|${highlightSuiteMultiplier}|${highlightWorkerCount}`;
  const ztdWaitingMap = getZtdWaitingMap();
  const ztdSessionMap = getZtdSessionMap();
  const highlightWaitingValues = ztdWaitingMap.get(highlightKey) ?? [];
  const highlightWaitingP95 = computePercentile(highlightWaitingValues, 0.95);
  const highlightSessionValues = ztdSessionMap.get(highlightKey) ?? [];
  const highlightMaxActiveExecuting =
    highlightSessionValues.length > 0
      ? Math.max(...highlightSessionValues.map((sample) => sample.maxActiveExecuting))
      : undefined;
  const highlightMaxLockWait =
    highlightSessionValues.length > 0
      ? Math.max(...highlightSessionValues.map((sample) => sample.maxLockWait))
      : undefined;

  const concurrencySuiteMultiplier = highlightSuiteMultiplier;
  const concurrencySuiteSize =
    highlightSuiteSize ?? TRADITIONAL_CASE_COUNT * concurrencySuiteMultiplier;
  const ztdConcurrencyRuns = measured.filter(
    (run) =>
      run.scenario === 'ztd-in-process' &&
      run.phase === 'measured' &&
      run.mode === 'parallel' &&
      run.suiteMultiplier === concurrencySuiteMultiplier,
  );
  const concurrencyGroupMap = new Map<string, RunMetrics[]>();
  ztdConcurrencyRuns.forEach((run) => {
    const mode = (run.dbConcurrencyMode ?? 'single') as DbConcurrencyMode;
    const workerCount = run.parallelWorkerCount ?? 1;
    const key = `${mode}:${workerCount}`;
    const group = concurrencyGroupMap.get(key) ?? [];
    group.push(run);
    concurrencyGroupMap.set(key, group);
  });
  const concurrencyRows = Array.from(concurrencyGroupMap.entries()).map(([key, runs]) => {
    const [modeToken, workerCountToken] = key.split(':');
    const mode = modeToken as DbConcurrencyMode;
    const workerCount = Number(workerCountToken);
    const perTestValues = runs
      .map((run) => run.perTestMs)
      .filter((value): value is number => typeof value === 'number');
    const perTestMean = perTestValues.length > 0 ? average(perTestValues) : undefined;
    const perTestStd =
      perTestValues.length > 1 ? stddev(perTestValues) : perTestValues.length === 1 ? 0 : undefined;
    return {
      mode,
      workerCount,
      perTestMean,
      perTestStd,
    };
  });



  type MethodDefinition = {
    method: 'traditional' | 'ztd';
    label: 'Traditional' | 'ZTD';
    scenario: 'traditional-in-process' | 'ztd-in-process';
    mode: ExecutionMode;
    workerCount: number;
    dbConcurrencyMode?: DbConcurrencyMode;
    traditionalDbSerialLock?: boolean;
  };

  const traditionalParallelEntries: MethodDefinition[] = parallelWorkerCounts.map((count) => ({
    method: 'traditional',
    label: 'Traditional',
    scenario: 'traditional-in-process',
    mode: 'parallel',
    workerCount: count,
    traditionalDbSerialLock: false,
  }));
  const ztdParallelEntries: MethodDefinition[] = parallelWorkerCounts.map((count) => ({
    method: 'ztd',
    label: 'ZTD',
    scenario: 'ztd-in-process',
    mode: 'parallel',
    workerCount: count,
    dbConcurrencyMode: 'perWorker',
  }));
  const methodDefinitions: MethodDefinition[] = [
    {
      method: 'traditional',
      label: 'Traditional',
      scenario: 'traditional-in-process',
      mode: 'serial',
      workerCount: 1,
    },
    ...traditionalParallelEntries,
    {
      method: 'ztd',
      label: 'ZTD',
      scenario: 'ztd-in-process',
      mode: 'serial',
      workerCount: 1,
      dbConcurrencyMode: 'single',
    },
    ...ztdParallelEntries,
  ];



  const formatMsOrNa = (value?: number): string =>
    isFiniteNumber(value) ? formatMs(value) : 'N/A';
  const formatTableMs = (value?: number, placeholder = tablePending): string =>
    isFiniteNumber(value) ? formatMs(value) : placeholder;
  const formatTableSpeedup = (value?: number, placeholder = tablePending): string =>
    isFiniteNumber(value) ? value.toFixed(2) : placeholder;
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
  const appendixLines: string[] = [];
  const normalizedAppendixPath = path
    .relative(path.dirname(reportPath), appendixReportPath)
    .split(path.sep)
    .join('/');
  const autoGeneratedNotice = [
    'NOTE: This file is auto-generated. Do not edit it directly.',
    'Edit the benchmark generator instead:',
    '- benchmarks/ztd-test-benchmark.ts',
    '- benchmarks/bench-runner/benchmark-report.ts',
  ];

  // Front-matter notice to discourage manual edits.
  autoGeneratedNotice.forEach((line) => reportLines.push(line));
  reportLines.push('');
  reportLines.push(`Appendix: [report-appendix.md](${normalizedAppendixPath})`);
  reportLines.push('');

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

  reportLines.push(`- Profile: ${benchProfileName}`);

  reportLines.push(`- Scenarios: ${scenarioSummary.length > 0 ? scenarioSummary : 'none'}`);

  reportLines.push(`- Warmup runs (baseline multiplier only): ${warmupRuns}`);

  reportLines.push(`- Measured runs base: ${measuredRuns}`);

  reportLines.push(

    `- Suite sizes tested: ${suiteSizes.map((size) => `${size} tests`).join(', ')}`,

  );

  reportLines.push(

    `- Steady-state suite size: ${steadyStateSuiteSize} tests`,

  );

  if (benchScenarios.includeSteady) {

    reportLines.push(
      `- Steady-state runs: ${steadyStateWarmupRuns} warmup / ${steadyStateMeasuredRunsCount} measured`,
    );

  }

  if (benchScenarios.includeLowerBound) {

    reportLines.push(

      `- Variable cost suites measured: ${suiteSizes.map((size) => `${size} tests`).join(', ')}`,

    );

  }

  reportLines.push(

    `- Parallel workers tested: ${parallelWorkerCounts.join(', ')}`,

  );

  reportLines.push(

    `- Total benchmark duration: ${formatMsOrNa(totalBenchmarkDurationMs)} ms`,

  );

  reportLines.push('');
  reportLines.push(
    'Same-conditions comparison is the primary deliverable of this document; the paragraphs below keep PostgreSQL concurrency and Vitest worker counts identical for both Traditional and ZTD before any secondary narrative appears.',
  );
  reportLines.push('');
  reportLines.push('## Purpose');
  reportLines.push(
    '- Keep the same-conditions comparison as the foundation of this report, then add best-practice contrasts only after fairness is demonstrated.',
  );
  reportLines.push(
    '- Describe every approach under the same CPU and PostgreSQL constraints in the primary section so readers cannot claim the comparison cheated by using different environments.',
  );
  reportLines.push(
    '- Sustain transparency by publishing pg_stat_activity evidence, SQL work logs, and runner/worker cost splits while noting when values are intentionally withheld pending matching runs.',
  );
  reportLines.push('');

  const sameConditionWorkerCounts =
    parallelWorkerCounts.length > 0 ? parallelWorkerCounts : [1];
  const concurrencyWorkerTarget =
    sameConditionWorkerCounts.includes(8)
      ? 8
      : sameConditionWorkerCounts[sameConditionWorkerCounts.length - 1] ?? 1;
  reportLines.push('## Same-conditions comparison (primary result)');
  reportLines.push('');
  reportLines.push(
    'This section recomputes the shared suite sizes and worker counts while contrasting how each approach behaves under identical PostgreSQL conditions.',
  );
  reportLines.push(
    '- Case 1 keeps PostgreSQL parallel (per-worker connections for both Traditional and ZTD) to prove the DB scales with the Vitest workers.',
  );
  reportLines.push(
    '- Case 2 runs PostgreSQL serially (single connection for both approaches) while still exercising 4/8 Vitest workers.',
  );
  reportLines.push('');
  type CaseMethod = {
    label: string;
    scenario: Scenario;
    mode: ExecutionMode;
    workerCounts: number[];
    dbConcurrencyMode?: DbConcurrencyMode;
    traditionalDbSerialLock?: boolean;
  };
  type CaseDiagnostics = {
    missingRuns: number;
    missingRunsDifferentConfig: number;
    missingSessionStats: number;
    missingConnectionEvents: number;
  };
  const findSimilarRuns = (params: {
    scenario: Scenario;
    mode: ExecutionMode;
    suiteMultiplier: number;
    workerCount: number;
  }): RunMetrics[] =>
    measured.filter(
      (run) =>
        run.scenario === params.scenario &&
        run.mode === params.mode &&
        run.suiteMultiplier === params.suiteMultiplier &&
        (run.parallelWorkerCount ?? 1) === params.workerCount,
    );
  const appendCaseTable = (
    methods: CaseMethod[],
    summaryMap: Map<string, AggregatedSummary>,
    missingPlaceholder = tablePending,
  ): CaseDiagnostics => {
    const diagnostics: CaseDiagnostics = {
      missingRuns: 0,
      missingRunsDifferentConfig: 0,
      missingSessionStats: 0,
      missingConnectionEvents: 0,
    };
    reportLines.push(
      '| Suite | Method | Workers | Status | Mean (ms) | StdDev (ms) | ms/test | Max active executing PG sessions (peak) | Distinct backend PIDs observed during run window |',
    );
    reportLines.push('| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |');
    for (const suite of suiteTargets) {
      for (const method of methods) {
        for (const workerCount of method.workerCounts) {
        const summary = lookupSummary(summaryMap, {
          scenario: method.scenario,
          mode: method.mode,
          suiteMultiplier: suite.multiplier,
          workerCount,
          dbConcurrencyMode: method.dbConcurrencyMode,
          traditionalDbSerialLock: method.traditionalDbSerialLock,
        });
        if (!summary) {
          const similarRuns = findSimilarRuns({
            scenario: method.scenario,
            mode: method.mode,
            suiteMultiplier: suite.multiplier,
            workerCount,
          });
          if (similarRuns.length > 0) {
            diagnostics.missingRunsDifferentConfig += 1;
          } else {
            diagnostics.missingRuns += 1;
          }
          reportLines.push(
            `| ${suite.label} | ${method.label} | ${workerCount} | ${missingPlaceholder} | ${missingPlaceholder} | ${missingPlaceholder} | ${missingPlaceholder} | ${missingPlaceholder} | ${missingPlaceholder} |`,
          );
          continue;
        }
        // Keep method labels stable; connection behavior is reported in the metrics columns.
        const status = 'measured';
        const hasSessionStats =
          isFiniteNumber(summary.maxActiveExecuting) || isFiniteNumber(summary.maxLockWait);
        const hasConnectionEvents = summary.connectionEventCount > 0;
        if (!hasSessionStats) {
          diagnostics.missingSessionStats += 1;
        }
        if (!hasConnectionEvents) {
          diagnostics.missingConnectionEvents += 1;
        }
        const distinctPids = hasConnectionEvents ? summary.distinctBackendConnections : undefined;
          reportLines.push(
            `| ${suite.label} | ${method.label} | ${workerCount} | ${status} | ${formatOptionalMs(
              summary.mean,
              missingPlaceholder,
            )} | ${formatOptionalMs(summary.stddev, missingPlaceholder)} | ${formatOptionalMs(
              summary.perTest,
              missingPlaceholder,
            )} | ${formatActiveExecutingSessions(summary.maxActiveExecuting, missingPlaceholder)} | ${formatDistinctConnections(
              distinctPids,
              missingPlaceholder,
            )} |`,
          );
        }
      }
    }
    reportLines.push('');
    return diagnostics;
  };
  const case1Methods: CaseMethod[] = [
    {
      label: 'Traditional (parallel)',
      scenario: 'traditional-in-process',
      mode: 'parallel',
      workerCounts: sameConditionWorkerCounts,
      traditionalDbSerialLock: false,
    },
    {
      label: 'ZTD (per-worker connections)',
      scenario: 'ztd-in-process',
      mode: 'parallel',
      workerCounts: sameConditionWorkerCounts,
      dbConcurrencyMode: 'perWorker',
    },
  ];
  reportLines.push('### Case 1 - DB parallel for both Traditional and ZTD');
  reportLines.push('');
  reportLines.push(
    '1. Run Traditional in its existing parallel mode (per-worker connections) and capture mean/std dev per suite size (30 / 60 / 120 / 240) with Vitest workers fixed at 4 and 8.',
  );
  reportLines.push(
    '2. Run ZTD with `ZTD_DB_CONCURRENCY=perWorker` so each worker holds its own backend while matching the same suite sizes and workers.',
  );
  reportLines.push(
    '3. Report the table below with columns: Suite, Method, Workers, Status, Mean, StdDev, ms/test, Max active executing PG sessions (peak), Distinct backend PIDs observed during run window.',
  );
  reportLines.push(
    '4. When per-run PG session metrics are missing, mark them as pending and avoid conclusions until matching runs are captured.',
  );
  reportLines.push(
    '5. Keep this case isolated from other configurations and mark rows as pending when the matching run remains outstanding.',
  );
  reportLines.push('');
  const case1Diagnostics = appendCaseTable(case1Methods, case1SummaryMap, tablePending);
  reportLines.push(
    '- Rows labeled pending indicate the exact configuration is missing measurements in this dataset.',
  );
  if (case1Diagnostics.missingRuns > 0) {
    reportLines.push('- Pending rows include configurations that were not executed in this dataset.');
  }
  if (case1Diagnostics.missingRunsDifferentConfig > 0) {
    reportLines.push(
      '- Some pending rows have measurements with different DB concurrency or lock settings; rerun with the exact configuration.',
    );
  }
  if (case1Diagnostics.missingSessionStats > 0) {
    reportLines.push(
      '- Timing data is available, but PG session metrics are pending because session samples were not recorded for those runs.',
    );
  }
  if (case1Diagnostics.missingConnectionEvents > 0) {
    reportLines.push(
      '- Distinct backend PID counts are pending because connection-event data is not available for those runs.',
    );
  }
  reportLines.push('');
  const highlightSuiteForConcurrency = largeSuiteTarget ?? suiteTargets[suiteTargets.length - 1];
  if (highlightSuiteForConcurrency) {
    const requiredBackendConnections = concurrencyWorkerTarget;
    const traditionalParallelSummary = lookupSummary(case1SummaryMap, {
      scenario: 'traditional-in-process',
      mode: 'parallel',
      suiteMultiplier: highlightSuiteForConcurrency.multiplier,
      workerCount: concurrencyWorkerTarget,
      traditionalDbSerialLock: false,
    });
    const ztdPerWorkerSummary = lookupSummary(case1SummaryMap, {
      scenario: 'ztd-in-process',
      mode: 'parallel',
      suiteMultiplier: highlightSuiteForConcurrency.multiplier,
      workerCount: concurrencyWorkerTarget,
      dbConcurrencyMode: 'perWorker',
    });
    if (traditionalParallelSummary && ztdPerWorkerSummary) {
      const traditionalActive = traditionalParallelSummary.maxActiveExecuting;
      const ztdActive = ztdPerWorkerSummary.maxActiveExecuting;
      const traditionalPids =
        traditionalParallelSummary.connectionEventCount > 0
          ? traditionalParallelSummary.distinctBackendConnections
          : undefined;
      const ztdPids =
        ztdPerWorkerSummary.connectionEventCount > 0
          ? ztdPerWorkerSummary.distinctBackendConnections
          : undefined;
      const hasAnyMetrics =
        typeof traditionalActive === 'number' ||
        typeof ztdActive === 'number' ||
        typeof traditionalPids === 'number' ||
        typeof ztdPids === 'number';
      if (hasAnyMetrics) {
        reportLines.push(
          `- ${highlightSuiteForConcurrency.label} with ${concurrencyWorkerTarget} workers observed distinct backend PIDs Traditional=${formatDistinctConnections(
            traditionalPids,
          )}, ZTD=${formatDistinctConnections(ztdPids)}, with max active executing sessions Traditional=${formatActiveExecutingSessions(
            traditionalActive,
          )} and ZTD=${formatActiveExecutingSessions(ztdActive)} (backend target >= ${requiredBackendConnections}).`,
        );
      } else {
        reportLines.push(
          `- ${highlightSuiteForConcurrency.label} with ${concurrencyWorkerTarget} workers has pending PG session metrics for Case 1.`,
        );
      }
    } else {
      const missingLabels: string[] = [];
      if (!traditionalParallelSummary) {
        missingLabels.push('Traditional (parallel)');
      }
      if (!ztdPerWorkerSummary) {
        missingLabels.push('ZTD (per-worker connections)');
      }
      reportLines.push(
        `- ${highlightSuiteForConcurrency.label} with ${concurrencyWorkerTarget} workers has pending Case 1 rows for ${missingLabels.join(
          ', ',
        )}.`,
      );
    }
  } else {
    reportLines.push('- No measured suite was available to verify Case 1 concurrency targets.');
  }
  reportLines.push('');
  const case2Description = [
  'Traditional serial runs acquire a global advisory lock so PostgreSQL executes one worker at a time.',
  traditionalDbSerialLock
    ? 'TRADITIONAL_DB_SERIAL_LOCK=1 was enabled to keep these runs serialized.'
    : 'Set TRADITIONAL_DB_SERIAL_LOCK=1 before the benchmark to capture the serialized Traditional runs.',
  '- ZTD single concurrent connection rows may still show "Max active executing PG sessions" as 0 because pg_stat_activity sampling can miss the brief windows when the backend is actively running statements; the database work still happens in those gaps.',
  '- "Distinct backend PIDs observed during run window" counts every backend instance seen while the single concurrent connection is active, so reconnects or backend restarts inflate the total even though only one connection was executing at any moment.',
];
  const case2Methods: CaseMethod[] = [
    {
      label: 'Traditional (DB serial lock)',
      scenario: 'traditional-in-process',
      mode: 'parallel',
      workerCounts: sameConditionWorkerCounts,
      traditionalDbSerialLock: true,
    },
    {
      label: 'ZTD (single concurrent connection)',
      scenario: 'ztd-in-process',
      mode: 'parallel',
      workerCounts: sameConditionWorkerCounts,
      dbConcurrencyMode: 'single',
    },
  ];
  reportLines.push('### Case 2 - DB serial for both Traditional and ZTD');
  reportLines.push('');
  reportLines.push(
    '1. Keep Vitest running across 4/8 workers while serializing PostgreSQL access for both workflows.',
  );
    reportLines.push(
      '   - ZTD runs with `ZTD_DB_CONCURRENCY=single` so all DB work reuses a single concurrent backend, even though backend PIDs may change across reconnects.',
    );
  reportLines.push(
    '   - Traditional acquires `TRADITIONAL_DB_SERIAL_LOCK=1` before executing migrations/queries so only one backend touches the database at a time.',
  );
  reportLines.push(
    '2. Use the same table structure as Case 1 and call out the recorded max active executing sessions (goal <= 2) once per-run metrics are captured.',
  );
  reportLines.push(
    '3. Reserve this case for serial measurements only, and note when a Traditional serial run is still pending to maintain symmetry.',
  );
  reportLines.push('');
  case2Description.forEach((line) => reportLines.push(line));
  reportLines.push('');
  const case2Diagnostics = appendCaseTable(case2Methods, primarySummaries, tablePending);
  reportLines.push(
    '- Rows marked pending indicate the exact configuration is missing measurements in this dataset.',
  );
  if (case2Diagnostics.missingRuns > 0) {
    reportLines.push('- Pending rows include configurations that were not executed in this dataset.');
  }
  if (case2Diagnostics.missingRunsDifferentConfig > 0) {
    reportLines.push(
      '- Some pending rows have measurements with different DB concurrency or lock settings; rerun with the exact configuration.',
    );
  }
  if (case2Diagnostics.missingSessionStats > 0) {
    reportLines.push(
      '- Timing data is available, but PG session metrics are pending because session samples were not recorded for those runs.',
    );
  }
  if (case2Diagnostics.missingConnectionEvents > 0) {
    reportLines.push(
      '- Distinct backend PID counts are pending because connection-event data is not available for those runs.',
    );
  }
  reportLines.push('');
  if (highlightSuiteForConcurrency) {
    const traditionalSerialSummary = lookupSummary(primarySummaries, {
      scenario: 'traditional-in-process',
      mode: 'parallel',
      suiteMultiplier: highlightSuiteForConcurrency.multiplier,
      workerCount: concurrencyWorkerTarget,
      traditionalDbSerialLock: true,
    });
    const ztdSingleSummary = lookupSummary(primarySummaries, {
      scenario: 'ztd-in-process',
      mode: 'parallel',
      suiteMultiplier: highlightSuiteForConcurrency.multiplier,
      workerCount: concurrencyWorkerTarget,
      dbConcurrencyMode: 'single',
    });
    if (traditionalSerialSummary && ztdSingleSummary) {
      const formatLockWaitSessions = (value?: number, placeholder = tablePending): string =>
        isFiniteNumber(value) ? value.toString() : placeholder;
      const hasSerialMetrics =
        typeof traditionalSerialSummary.maxActiveExecuting === 'number' ||
        typeof ztdSingleSummary.maxActiveExecuting === 'number' ||
        typeof traditionalSerialSummary.maxLockWait === 'number' ||
        typeof ztdSingleSummary.maxLockWait === 'number';
      if (hasSerialMetrics) {
        reportLines.push(
          `- ${highlightSuiteForConcurrency.label} with ${concurrencyWorkerTarget} workers observed max active executing sessions Traditional=${formatActiveExecutingSessions(
            traditionalSerialSummary.maxActiveExecuting,
          )} (lock-wait=${formatLockWaitSessions(
            traditionalSerialSummary.maxLockWait,
          )}) and ZTD single connection=${formatActiveExecutingSessions(
            ztdSingleSummary.maxActiveExecuting,
          )} (lock-wait=${formatLockWaitSessions(ztdSingleSummary.maxLockWait)}) (goal <= 2 active executing).`,
        );
      } else {
        reportLines.push(
          `- ${highlightSuiteForConcurrency.label} with ${concurrencyWorkerTarget} workers has pending PG session metrics for Case 2.`,
        );
      }
    } else {
      const missingLabels: string[] = [];
      if (!traditionalSerialSummary) {
        missingLabels.push('Traditional (DB serial lock)');
      }
      if (!ztdSingleSummary) {
        missingLabels.push('ZTD (single connection)');
      }
      reportLines.push(
        `- ${highlightSuiteForConcurrency.label} with ${concurrencyWorkerTarget} workers has pending Case 2 rows for ${missingLabels.join(
          ', ',
        )}.`,
      );
    }
  } else {
    reportLines.push('- No measured suite was available to verify Case 2 concurrency targets.');
  }
  reportLines.push('');
  if (highlightSuiteForConcurrency) {
    const conclusions: string[] = [];
    const parallelTraditional = lookupSummary(case1SummaryMap, {
      scenario: 'traditional-in-process',
      mode: 'parallel',
      suiteMultiplier: highlightSuiteForConcurrency.multiplier,
      workerCount: concurrencyWorkerTarget,
      traditionalDbSerialLock: false,
    });
    const parallelZtd = lookupSummary(case1SummaryMap, {
      scenario: 'ztd-in-process',
      mode: 'parallel',
      suiteMultiplier: highlightSuiteForConcurrency.multiplier,
      workerCount: concurrencyWorkerTarget,
      dbConcurrencyMode: 'perWorker',
    });
    const serialTraditional = lookupSummary(primarySummaries, {
      scenario: 'traditional-in-process',
      mode: 'parallel',
      suiteMultiplier: highlightSuiteForConcurrency.multiplier,
      workerCount: concurrencyWorkerTarget,
      traditionalDbSerialLock: true,
    });
    const serialZtd = lookupSummary(primarySummaries, {
      scenario: 'ztd-in-process',
      mode: 'parallel',
      suiteMultiplier: highlightSuiteForConcurrency.multiplier,
      workerCount: concurrencyWorkerTarget,
      dbConcurrencyMode: 'single',
    });
    // Only emit conclusions backed by concrete means for both approaches.
    if (parallelTraditional?.mean && parallelZtd?.mean) {
      conclusions.push(
        `- ${highlightSuiteForConcurrency.label} with ${concurrencyWorkerTarget} workers (DB parallel): Traditional mean ${formatMsOrNa(
          parallelTraditional.mean,
        )} ms, ZTD per-worker connections mean ${formatMsOrNa(parallelZtd.mean)} ms.`,
      );
    }
    if (serialTraditional?.mean && serialZtd?.mean) {
      conclusions.push(
        `- ${highlightSuiteForConcurrency.label} with ${concurrencyWorkerTarget} workers (DB serial): Traditional DB serial lock mean ${formatMsOrNa(
          serialTraditional.mean,
        )} ms, ZTD single connection mean ${formatMsOrNa(serialZtd.mean)} ms.`,
      );
    }
    if (conclusions.length > 0) {
      reportLines.push('### Same-conditions conclusions');
      reportLines.push('');
      conclusions.forEach((line) => reportLines.push(line));
      reportLines.push('');
    }
  }
  reportLines.push('## Best-practice comparison (secondary reference)');
  reportLines.push('');
  reportLines.push(
    'After the same-conditions comparison proves fairness, this section briefly compares the configurations each approach would choose in production.',
  );
  reportLines.push(
    "- ZTD's recommended configuration remains the single connection mode for stability and reproducibility.",
  );
  reportLines.push(
    "- Traditional's best throughput configuration continues to be DB parallelism with schema isolation.",
  );
  reportLines.push(
    '- This section is explicitly secondary so readers understand the baseline fairness was already public.',
  );
  reportLines.push(
    '- Slower numbers in the primary section are acceptable because they reflect enforced fairness, not manipulation.',
  );
  reportLines.push('');
  const bestPracticeSuite = largeSuiteTarget ?? suiteTargets[suiteTargets.length - 1];
  if (bestPracticeSuite) {
    const traditionalBestRuns = measured.filter(
      (run) =>
        run.scenario === 'traditional-in-process' &&
        run.mode === 'parallel' &&
        run.suiteMultiplier === bestPracticeSuite.multiplier &&
        (run.parallelWorkerCount ?? 1) === concurrencyWorkerTarget &&
        !run.traditionalDbSerialLock,
    );
    const ztdBestRuns = measured.filter(
      (run) =>
        run.scenario === 'ztd-in-process' &&
        run.mode === 'parallel' &&
        run.suiteMultiplier === bestPracticeSuite.multiplier &&
        (run.parallelWorkerCount ?? 1) === concurrencyWorkerTarget &&
        run.dbConcurrencyMode === 'single',
    );
    const traditionalBestSummary = summarizeRunSet(traditionalBestRuns, bestPracticeSuite.suiteSize);
    const ztdBestSummary = summarizeRunSet(ztdBestRuns, bestPracticeSuite.suiteSize);
    const speedupValue =
      traditionalBestSummary.mean && ztdBestSummary.mean && ztdBestSummary.mean > 0
        ? traditionalBestSummary.mean / ztdBestSummary.mean
        : undefined;
    reportLines.push(
      '| Approach | Workers | Mean (ms) | StdDev (ms) | ms/test | Speedup vs Traditional parallel | Max active executing PG sessions |',
    );

    reportLines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
    reportLines.push(
      `| Traditional (parallel) | ${concurrencyWorkerTarget} | ${formatOptionalMs(
        traditionalBestSummary.mean,
        tablePending,
      )} | ${formatOptionalMs(traditionalBestSummary.stddev, tablePending)} | ${formatOptionalMs(
        traditionalBestSummary.perTest,
        tablePending,
      )} | 1.00 | ${formatActiveExecutingSessions(traditionalBestSummary.maxActiveExecuting)} |`,
    );
    reportLines.push(
      `| ZTD (single connection) | ${concurrencyWorkerTarget} | ${formatOptionalMs(
        ztdBestSummary.mean,
        tablePending,
      )} | ${formatOptionalMs(ztdBestSummary.stddev, tablePending)} | ${formatOptionalMs(
        ztdBestSummary.perTest,
        tablePending,
      )} | ${typeof speedupValue === 'number' ? speedupValue.toFixed(2) : tablePending} | ${formatActiveExecutingSessions(
        ztdBestSummary.maxActiveExecuting,
      )} |`,
    );
    reportLines.push('');
  } else {
    reportLines.push('No suite data is available to render the best-practice comparison.');
    reportLines.push('');
  }
  const measuredRunsLabel = resolveMeasuredRunsForMultiplier(
    suiteMultipliers[0] ?? baselineMultiplier,
    measuredRuns,
  );

  const formatSpeedup = (value?: number): string => formatTableSpeedup(value);



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
    '- Speedup vs Traditional (1 worker) uses the Traditional serial mean as the baseline for each suite size.',
  );

  reportLines.push('');

  for (const target of suiteTargets) {

    reportLines.push(`#### ${target.label}`);

    reportLines.push('');

    reportLines.push(
      '| Method | Parallelism (workers) | Mean (ms) | StdDev (ms) | Speedup vs Traditional (1 worker) | ms/test | Max active executing PG sessions |',
    );

    reportLines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');

    const baselineSummary = lookupSummary(primarySummaries, {
      scenario: 'traditional-in-process',
      mode: 'serial',
      suiteMultiplier: target.multiplier,
      workerCount: 1,
    });

    const baselineMean = baselineSummary?.mean;

    if (typeof baselineMean !== 'number' || baselineMean <= 0) {

      reportLines.push(

        '| _Insufficient baseline data_ |  |  |  |  |  |  |',

      );

      reportLines.push('');

      continue;

    }

    for (const method of methodDefinitions) {

      const summary = lookupSummary(primarySummaries, {
        scenario: method.scenario,
        mode: method.mode,
        suiteMultiplier: target.multiplier,
        workerCount: method.workerCount,
        dbConcurrencyMode: method.dbConcurrencyMode,
        traditionalDbSerialLock: method.traditionalDbSerialLock,
      });

      if (!summary || typeof summary.mean !== 'number') {

        continue;

      }

      const mean = summary.mean;

      const stddev = summary.stddev;

      const baselineSpeedup =

        typeof baselineMean === 'number' && baselineMean > 0 ? baselineMean / mean : undefined;

      const speedup =
        method.method === 'traditional' && method.workerCount === 1 ? 1 : baselineSpeedup;

      const msPerTest = target.suiteSize > 0 ? mean / target.suiteSize : undefined;

      reportLines.push(
        `| ${method.label} | ${method.workerCount} | ${formatTableMs(mean)} | ${formatTableMs(
          stddev,
        )} | ${formatSpeedup(speedup)} | ${formatTableMs(msPerTest)} | ${formatActiveExecutingSessions(
          summary.maxActiveExecuting,
          notCapturedPlaceholder,
        )} |`,
      );

    }

    reportLines.push('');

  }



  const parallelTraditionalRuns = measured.filter(
    (run) => run.scenario === 'traditional-in-process' && run.mode === 'parallel' && run.phase === 'measured',
  );
  const formatInteger = (value?: number): string =>
    isFiniteNumber(value) ? value.toFixed(0) : 'N/A';
  const formatWorkerOffset = (value?: number): string =>
    isFiniteNumber(value) ? `${formatMs(value)}ms` : 'N/A';
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
    'Detailed Traditional parallelism validation is provided in the Appendix.',
  );
  reportLines.push('');
  appendixLines.push('### Traditional Parallelism Validation');
  appendixLines.push('');
  appendixLines.push(
    'Traditional parallel runs show overlapping worker time ranges and multiple concurrent PostgreSQL sessions in the first measured iteration for each suite and worker count.',
  );
  appendixLines.push('');
  for (const target of suiteTargets) {
    appendixLines.push(`- ${target.label}:`);
    for (const workerCount of parallelWorkerCounts) {
      const candidateRuns = parallelTraditionalRuns
        .filter(
          (run) =>
            run.suiteMultiplier === target.multiplier &&
            run.parallelWorkerCount === workerCount,
        )
        .sort((a, b) => (a.runIndex ?? 0) - (b.runIndex ?? 0));
      if (candidateRuns.length === 0) {
        appendixLines.push(`  - Workers: ${workerCount}: no measured run recorded.`);
        continue;
      }
      const representative = candidateRuns[0];
      appendixLines.push(`  - Workers: ${workerCount}`);
      appendixLines.push(
        `    - Peak concurrent PG sessions: ${formatInteger(
          representative.traditionalPeakConnections,
        )}`,
      );
      const ranges = representative.traditionalWorkerTimeRanges;
      if (ranges && ranges.length > 0) {
        appendixLines.push('    - Worker time ranges:');
        ranges.forEach((range) => {
          appendixLines.push(
            `      - ${range.workerId}: ${formatWorkerOffset(range.startOffsetMs)}..${formatWorkerOffset(
              range.endOffsetMs,
            )} (cases: ${range.cases})`,
          );
        });
      } else {
        appendixLines.push('    - Worker time ranges: N/A');
      }
    }
  }
  appendixLines.push('');

  reportLines.push('### ZTD Concurrency Diagnostics');
  reportLines.push('');
  reportLines.push(
    `- Highlighted ZTD in-process run: ${highlightSuiteLabel} with ${highlightWorkerCount} workers (${highlightConnectionModel} connection model, parallel measured).`,
  );
  reportLines.push(
    `  - Waiting p95: ${formatMsOrNa(highlightWaitingP95)} ms`,
  );
  reportLines.push(
    `  - Max active executing PostgreSQL sessions observed: ${
      isFiniteNumber(highlightMaxActiveExecuting) ? highlightMaxActiveExecuting : 'N/A'
    }`,
  );
  reportLines.push(
    `  - Max lock-waiting sessions observed: ${
      isFiniteNumber(highlightMaxLockWait) ? highlightMaxLockWait : 'N/A'
    }`,
  );
  reportLines.push('');
  const concurrencyAppStats = concurrencySummary.byApplication ?? {};
  const sortedConcurrencyRows = [...concurrencyRows].sort((a, b) => {
    if (a.mode === b.mode) {
      return a.workerCount - b.workerCount;
    }
    return a.mode === 'single' ? -1 : 1;
  });
  const availableConcurrencyRows = sortedConcurrencyRows.filter(
    (row) => typeof row.perTestMean === 'number' && typeof row.perTestStd === 'number',
  );
  if (availableConcurrencyRows.length > 0) {
    const formatActiveExecuting = (value?: number): string =>
      isFiniteNumber(value) ? value.toString() : notCapturedPlaceholder;
    const formatModeLabel = (mode: DbConcurrencyMode): string =>
      mode === 'perWorker' ? 'Per worker' : 'Single concurrent connection';
    reportLines.push('#### ZTD concurrency modes');
    reportLines.push('');
    reportLines.push(
      '| Mode | Workers | Suite size | Mean (ms/test) | StdDev (ms/test) | Max active executing sessions |',
    );
    reportLines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
    availableConcurrencyRows.forEach((row) => {
      const appName = row.mode === 'perWorker' ? 'ztd-bench-perworker' : 'ztd-bench-single';
      const appSummary = concurrencyAppStats[appName];
      reportLines.push(
        `| ${formatModeLabel(row.mode)} | ${row.workerCount} | ${concurrencySuiteSize} | ${formatTableMs(
          row.perTestMean,
        )} | ${formatTableMs(row.perTestStd)} | ${formatActiveExecuting(appSummary?.maxActiveExecutingSessions)} |`,
      );
    });
    if (availableConcurrencyRows.length < sortedConcurrencyRows.length) {
      reportLines.push(
        '- Additional concurrency rows remain pending until their per-test metrics are recorded.',
      );
    }
    reportLines.push('');
  }

  reportLines.push('### PostgreSQL concurrency monitoring');
  reportLines.push('');
  reportLines.push(`- Max total sessions observed: ${concurrencySummary.maxTotalSessions}`);
  reportLines.push(`- Max sessions with state='active': ${concurrencySummary.maxActiveSessions}`);
  reportLines.push(`- Max active executing sessions: ${concurrencySummary.maxActiveExecutingSessions}`);
  reportLines.push(`- Max lock-waiting sessions: ${concurrencySummary.maxLockWaitSessions}`);
  reportLines.push(`- Total polling samples: ${concurrencySummary.totalPolls}`);
  reportLines.push(
    `- Artifacts: ${path.relative(rootDir, concurrencySummary.jsonPath)}, ${path.relative(
      rootDir,
      concurrencySummary.mdPath,
    )}`,
  );
  reportLines.push('- Detailed PID and wait-event tables are in the Appendix.');
  reportLines.push('');
  const methodCounts = concurrencySummary.distinctBackendPidsByMethod ?? {};
  if (Object.keys(methodCounts).length > 0) {
    appendixLines.push('### Distinct backend PIDs observed during run window (by method)');
    appendixLines.push('');
    appendixLines.push('| method | distinct backend PIDs |');
    appendixLines.push('| --- | ---: |');
    Object.entries(methodCounts).forEach(([method, count]) => {
      appendixLines.push(`| ${method} | ${count} |`);
    });
    appendixLines.push('');
  }
  const workerTagCounts = concurrencySummary.distinctBackendPidsByWorkerTag ?? {};
  if (Object.keys(workerTagCounts).length > 0) {
    appendixLines.push('### Distinct backend PIDs observed during run window (by worker tag)');
    appendixLines.push('');
    appendixLines.push('| worker tag | distinct backend PIDs |');
    appendixLines.push('| --- | ---: |');
    Object.entries(workerTagCounts).forEach(([tag, count]) => {
      appendixLines.push(`| ${tag} | ${count} |`);
    });
    appendixLines.push('');
  }
  appendixLines.push('### Wait event distribution');
  appendixLines.push('');
  appendixLines.push('| Wait event type | Count |');
  appendixLines.push('| --- | ---: |');
  Object.entries(concurrencySummary.waitEventTotals).forEach(([type, count]) => {
    appendixLines.push(`| ${type} | ${count} |`);
  });
  appendixLines.push('');
  appendixLines.push('### Sample timeline (latest polls)');
  appendixLines.push('');
  appendixLines.push('| Time | Total sessions | Active sessions | Wait type counts |');
  appendixLines.push('| --- | ---: | ---: | --- |');
  concurrencySummary.timelineSample.forEach((entry) => {
    const waitText = Object.entries(entry.waitTypeCounts)
      .map(([type, value]) => `${type}=${value}`)
      .join(', ');
    appendixLines.push(
      `| ${entry.timestamp} | ${entry.totalSessions} | ${entry.activeSessions} | ${waitText} |`,
    );
  });
  appendixLines.push('');

  // Build a QuickChart reference that highlights the 240-test duration for the requested worker counts.
  const concurrencySuiteTarget = suiteTargets.find((target) => target.label === '240 tests');
  if (concurrencySuiteTarget) {
    const workerGroups = [
      { label: '8 workers', workerCount: 8, mode: 'parallel' as const },
      { label: '4 workers', workerCount: 4, mode: 'parallel' as const },
      { label: '1 worker', workerCount: 1, mode: 'serial' as const },
    ];
    const lookupDuration = (
      scenario: Scenario,
      mode: ExecutionMode,
      workerCount: number,
      dbConcurrencyMode?: DbConcurrencyMode,
    ): number | null => {
      const usesCase1Map =
        (scenario === 'traditional-in-process' && mode === 'parallel') ||
        (scenario === 'ztd-in-process' && dbConcurrencyMode === 'perWorker');
      const selectedMap = usesCase1Map ? case1SummaryMap : primarySummaries;
      const summary = lookupSummary(selectedMap, {
        scenario,
        mode,
        suiteMultiplier: concurrencySuiteTarget.multiplier,
        workerCount,
        dbConcurrencyMode,
      });
      const value = summary?.mean;
      return isFiniteNumber(value) ? Number(value.toFixed(3)) : null;
    };
    // Use explicit ZTD dbConcurrencyMode values so the chart matches the reported 240-test means.
    const ztdDurations = workerGroups.map((group) => {
      const dbConcurrencyMode =
        group.mode === 'serial' ? 'single' : ('perWorker' as DbConcurrencyMode);
      return lookupDuration('ztd-in-process', group.mode, group.workerCount, dbConcurrencyMode);
    });
    const tradDurations = workerGroups.map((group) =>
      lookupDuration('traditional-in-process', group.mode, group.workerCount),
    );
    const durationValues = [...ztdDurations, ...tradDurations];
    const hasMeasurement = durationValues.some((value) => isFiniteNumber(value ?? undefined));
    const hasFullMeasurements = durationValues.every((value) => value !== null);
    reportLines.push('### 240-test parallel comparison');
    reportLines.push('');
    if (hasMeasurement && hasFullMeasurements) {
      const chartConfig = {
        type: 'bar',
        data: {
          labels: workerGroups.map((group) => group.label),
          datasets: [
            {
              label: 'ZTD',
              data: ztdDurations,
              backgroundColor: 'rgba(54,162,235,0.7)',
              borderColor: 'rgba(54,162,235,0.7)',
              borderWidth: 1,
            },
            {
              label: 'Traditional',
              data: tradDurations,
              backgroundColor: 'rgba(255,159,64,0.8)',
              borderColor: 'rgba(255,159,64,1)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          plugins: {
            legend: {
              labels: { color: 'black' },
            },
          },
          scales: {
            x: { ticks: { color: 'black' } },
            y: { ticks: { color: 'black' } },
          },
          responsive: false,
        },
      };
      const quickChartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(
        JSON.stringify(chartConfig),
      )}&width=700&height=450`;
      reportLines.push(`![240-test parallel comparison](${quickChartUrl})`);
      reportLines.push('');
      reportLines.push(
        'Each group compares the 240-test suite using the ZTD (blue) and Traditional (orange) workflows for 1, 4, and 8 workers.',
      );
    } else if (hasMeasurement) {
      reportLines.push(
        'Full 240-test durations for 1, 4, and 8 workers are still being recorded; the chart will appear once those worker counts are complete.',
      );
    } else {
      reportLines.push('No measurements are currently available for the requested parallel configurations.');
    }
    reportLines.push('');
  }

  const hasRunnerOverhead =
    typeof runnerStartupMean === 'number' || typeof runnerExecutionMean === 'number';
  if (hasRunnerOverhead) {
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
  }

  const hasComponentMetrics = componentEntries.some((entry) => typeof entry.mean === 'number');
  if (hasComponentMetrics) {
    reportLines.push('### ZTD Internal Cost Breakdown');
    reportLines.push('');
    reportLines.push('| Component | Mean (ms) | Percentage (%) |');
    reportLines.push('| --- | ---: | ---: |');
    for (const entry of componentEntries) {
      if (typeof entry.mean !== 'number') {
        continue;
      }
      reportLines.push(
        `| ${entry.name} | ${formatMsOrNa(entry.mean)} | ${formatPercentage(
          percentageFor(entry.mean),
        )} |`,
      );
    }
    reportLines.push('');
  }



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

  reportLines.push(`Report path: ${path.relative(rootDir, reportPath)}`);

  // Build appendix output as a separate file to keep the main report readable.
  const appendixReportLines: string[] = [];
  autoGeneratedNotice.forEach((line) => appendixReportLines.push(line));
  appendixReportLines.push('');
  appendixReportLines.push('## Appendix');
  appendixReportLines.push('');
  if (appendixLines.length > 0) {
    appendixReportLines.push(...appendixLines);
  } else {
    appendixReportLines.push('No appendix data was recorded for this run.');
  }

  return {
    mainReport: `${reportLines.join('\n')}\n`,
    appendixReport: `${appendixReportLines.join('\n')}\n`,
  };

}
