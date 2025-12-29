import type { PgConcurrencySummary } from '../../support/pg-concurrency';
import type {
  BenchProfileName,
  BenchScenarioSelection,
  ExecutionMode,
  MetricsStatusEntry,
  RunMetrics,
  RunPhase,
} from '../types';

export type DbConcurrencyMode = 'single' | 'perWorker';
export type ConnectionModelLabel = 'perWorker' | 'caseLocal';

export type SessionStatEntry = {
  scenarioLabel: string;
  mode: ExecutionMode;
  phase: RunPhase;
  suiteMultiplier: number;
  runIndex: number;
  workerCount: number;
  dbConcurrencyMode?: DbConcurrencyMode;
  maxActiveExecutingSessions: number;
  maxLockWaitSessions: number;
};

export type ConnectionEventEntry = {
  scenarioLabel: string;
  mode: ExecutionMode;
  phase: RunPhase;
  suiteMultiplier: number;
  workerCount?: number;
  dbConcurrencyMode?: DbConcurrencyMode;
  traditionalDbSerialLock?: boolean;
  pid: number;
  workerId?: string;
};

export type BenchPhaseEntry = {
  phase?: string;
  status?: string;
  context?: {
    approach?: string;
    phase?: string;
    mode?: string;
  };
  waitingMs?: number;
  durationMs?: number;
  cleanupMs?: number;
};

export type ZtdSessionSample = {
  maxActiveExecuting: number;
  maxLockWait: number;
};

export type ReportInput = {
  results: RunMetrics[];
  databaseInfo: string;
  suiteMultipliers: number[];
  steadyStateSuiteMultiplier: number;
  totalBenchmarkDurationMs: number;
  concurrencySummary: PgConcurrencySummary;
  benchProfileName: BenchProfileName;
  benchScenarios: BenchScenarioSelection;
  warmupRuns: number;
  measuredRuns: number;
  measuredRunsLabel: number;
  runnerWarmups: number;
  runnerMeasuredRuns: number;
  steadyStateWarmups: number;
  steadyStateMeasuredRuns: number;
  parallelWorkerCounts: number[];
  benchConnectionModels: ConnectionModelLabel[];
  traditionalCaseCount: number;
  traditionalDbSerialLock: boolean;
  reportPath: string;
  rootDir: string;
  sessionStats: SessionStatEntry[];
  connectionEvents: ConnectionEventEntry[];
  benchPhaseEntries: BenchPhaseEntry[];
  ztdWaitingMap: Map<string, number[]>;
  ztdSessionMap: Map<string, ZtdSessionSample[]>;
  metricsStatusEntries: MetricsStatusEntry[];
};

export type ReportModel = ReportInput;

/**
 * Collect the computed report model from raw benchmark inputs.
 */
export function collectReportModel(input: ReportInput): ReportModel {
  return input;
}
