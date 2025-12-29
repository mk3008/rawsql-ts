import fs from 'node:fs';
import path from 'node:path';
import type { ConnectionModel } from '../../ztd-bench/tests/support/diagnostics';
import type { BenchScenarioSelection, BenchProfileName } from '../types';

export type ReportMetadata = {
  metadataVersion: 1;
  databaseInfo: string;
  suiteMultipliers: number[];
  steadyStateSuiteMultiplier: number;
  totalBenchmarkDurationMs: number;
  benchProfileName: BenchProfileName;
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
  runTagPrefix: string;
};

export function writeReportMetadata(filePath: string, metadata: ReportMetadata): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), 'utf8');
}

export function readReportMetadata(filePath: string): ReportMetadata {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as ReportMetadata;
  if (parsed.metadataVersion !== 1) {
    throw new Error(`Unsupported report metadata version: ${parsed.metadataVersion ?? 'unknown'}`);
  }
  return parsed;
}
