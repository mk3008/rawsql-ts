import type { ConnectionModel, DbConcurrencyMode, RunPhase } from '../ztd-bench-vs-raw/tests/support/diagnostics';

export type ExecutionMode = 'serial' | 'parallel';
export type Scenario =
  | 'ztd-runner'
  | 'traditional-runner'
  | 'traditional-in-process'
  | 'ztd-in-process'
  | 'ztd-steady-state'
  | 'traditional-steady-state';
export type BenchProfileName = 'quick' | 'dev' | 'ci';
export type BenchProfile = {
  name: BenchProfileName;
  defaults: {
    warmupRuns: number;
    measuredRuns: number;
    suiteMultipliers: number[];
    steadyStateIterations: number;
    steadyStateSuiteMultiplier: number;
  };
};
export type BenchScenarioSelection = {
  label: string;
  includeRunner: boolean;
  includeSteady: boolean;
  includeLowerBound: boolean;
};

export type SteadyStateMetrics = {
  iterationTotalMs: number[];
  iterationSqlCount: number[];
  iterationDbMs: number[];
  iterationRewriteMs?: number[];
  iterationFixtureMs?: number[];
  iterationSqlGenerationMs?: number[];
  iterationOtherMs?: number[];
};

export type WorkerTimeRange = {
  workerId: string;
  cases: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
};

export type RunMetrics = {
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
  dbConcurrencyMode?: DbConcurrencyMode;
  traditionalDbSerialLock?: boolean;
};

export type MetricsStatusEntry = {
  scenario: Scenario;
  mode: ExecutionMode;
  suiteMultiplier: number;
  phase: RunPhase;
  runIndex: number;
  metricsPresent: boolean;
  usedFiles: string[];
  missingFiles: string[];
};

export type WorkerActivity = {
  connectionModel: ConnectionModel;
  scenarioLabel: string;
  mode: ExecutionMode;
  workerId: string;
  cases: number;
  startMs?: number;
  endMs?: number;
  migrationStatements: number;
};

export type TraditionalParallelDiagnostic = {
  casesPerWorker: Map<string, number>;
  activeConnections: number;
  peakConnections: number;
};

export type RecordedStatement = {
  text: string;
  values?: unknown[];
};
