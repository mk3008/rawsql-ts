import path from 'node:path';

export const REPORT_FILE_PATH = path.join('benchmarks', 'sql-unit-test', 'report.md');
export const RESULTS_JSON_PATH = path.join('tmp', 'customer-summary-bench-results.json');
export const DDL_FILE_PATH = path.join('benchmarks', 'sql-unit-test', 'ztd', 'ddl', 'public.sql');
export const COST_LOG_PATH = path.join('tmp', 'customer-summary-stage-costs.jsonl');

export const TEST_COUNTS = [300] as const;
export const REPEAT_ITERATIONS = 5;
export const PARALLEL_WORKERS = [1];
export const CONNECTION_PROFILES = ['perTest', 'shared'] as const;

export type ConnectionProfile = (typeof CONNECTION_PROFILES)[number];

export type MeasurementStats = {
  meanTotalMs: number;
  errorTotalMs: number;
  stdDevTotalMs: number;
};

export type MeasurementRow = {
  mode: 'ztd' | 'traditional';
  testCount: number;
  parallel: number;
  connectionProfile: ConnectionProfile;
  stats: MeasurementStats;
};

export type LogSamples = {
  ztdOriginal?: string;
  ztdRewritten?: string;
  traditionalOriginal?: string;
};

export const CONNECTION_PROFILE_LABELS: Record<ConnectionProfile, string> = {
  perTest: 'perTest (exclusive)',
  shared: 'shared (reused)',
};

export const STAGE_ORDER = ['connection', 'query', 'verify', 'cleanup'] as const;
export type StageLogEntry = {
  mode: 'ztd' | 'traditional';
  connectionProfile: ConnectionProfile;
  testCount: number;
  parallel: number;
  repetition: number;
  durationMs: number;
  stageDurations: Record<string, number>;
};

export type StageBreakdownRow = {
  mode: 'ztd' | 'traditional';
  connectionProfile: ConnectionProfile;
  testCount: number;
  parallel: number;
  stageMeans: Record<string, number>;
  totalMean: number;
};
