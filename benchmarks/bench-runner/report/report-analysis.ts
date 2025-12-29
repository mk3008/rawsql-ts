import fs from 'node:fs';
import path from 'node:path';
import {
  appendConnectionEvents,
  appendSessionStats,
  clearConnectionEvents,
  clearSessionStats,
  type ConnectionLoggerEntry,
  type SessionStat,
} from '../../ztd-bench/tests/support/diagnostics';
import { loadPersistedConnectionEvents } from '../diagnostics/connection-events';
import { loadPersistedSessionStats } from '../diagnostics/session-stats';
import { loadRunMetricsFromDisk } from '../metrics';
import type { RunMetrics } from '../types';
import {
  APPENDIX_REPORT_PATH,
  REPORT_METADATA_PATH,
  REPORT_PATH,
  ROOT_DIR,
  TMP_DIR,
} from '../runtime/paths';
import { writeBenchmarkReports } from './report-writer';
import { readReportMetadata } from './report-metadata';
import { loadPgConcurrencySummaryFromDisk } from '../../support/pg-concurrency';

function resolveSupplementalDirs(): string[] {
  const raw = process.env.ZTD_BENCH_SUPPLEMENTAL_TMP_DIRS ?? '';
  if (raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => path.isAbsolute(entry) ? entry : path.join(ROOT_DIR, entry))
    .filter((dirPath) => fs.existsSync(dirPath));
}

function loadCombinedSessionStats(tmpDir: string, runTagPrefix: string, supplementalDirs: string[]): SessionStat[] {
  const base = [...loadPersistedSessionStats(tmpDir, runTagPrefix)];
  for (const supplemental of supplementalDirs) {
    base.push(...loadPersistedSessionStats(supplemental, runTagPrefix));
  }
  return base;
}

function loadCombinedConnectionEvents(
  tmpDir: string,
  runTagPrefix: string,
  supplementalDirs: string[],
): ConnectionLoggerEntry[] {
  const base = [...loadPersistedConnectionEvents(tmpDir, runTagPrefix)];
  for (const supplemental of supplementalDirs) {
    base.push(...loadPersistedConnectionEvents(supplemental, runTagPrefix));
  }
  return base;
}

export async function runAnalysisOnlyFromDisk(): Promise<void> {
  // Fall back to legacy benchmarks/tmp/bench output if repo-root metadata is missing.
  const legacyTmpDir = path.join(ROOT_DIR, 'benchmarks', 'tmp', 'bench');
  const legacyMetadataPath = path.join(legacyTmpDir, 'report-metadata.json');
  let metadataPath = REPORT_METADATA_PATH;
  let tmpDir = TMP_DIR;
  let useLegacy = false;
  if (!fs.existsSync(metadataPath)) {
    if (!fs.existsSync(legacyMetadataPath)) {
      throw new Error(
        `Report metadata not found at ${path.relative(ROOT_DIR, REPORT_METADATA_PATH)} or ${path.relative(
          ROOT_DIR,
          legacyMetadataPath,
        )}. Run the benchmark first.`,
      );
    }
    metadataPath = legacyMetadataPath;
    tmpDir = legacyTmpDir;
    useLegacy = true;
  }
  const metadata = readReportMetadata(metadataPath);
  const supplementalDirs = resolveSupplementalDirs();
  const recordedRuns = loadRunMetricsFromDisk(tmpDir, metadata.runTagPrefix);
  const supplementalRuns = supplementalDirs.flatMap((dir) =>
    loadRunMetricsFromDisk(dir, metadata.runTagPrefix),
  );
  const persistedSessionStats = loadCombinedSessionStats(tmpDir, metadata.runTagPrefix, supplementalDirs);
  const persistedConnectionEvents = loadCombinedConnectionEvents(
    tmpDir,
    metadata.runTagPrefix,
    supplementalDirs,
  );
  clearSessionStats();
  appendSessionStats(persistedSessionStats);
  clearConnectionEvents();
  appendConnectionEvents(persistedConnectionEvents);
  const concurrencySummaryResult = await loadPgConcurrencySummaryFromDisk(tmpDir);
  const reportPath = useLegacy ? REPORT_PATH : metadata.reportPath;
  const appendixReportPath = useLegacy ? APPENDIX_REPORT_PATH : metadata.appendixReportPath;
  const rootDir = useLegacy ? ROOT_DIR : metadata.rootDir;
  writeBenchmarkReports({
    results: [...recordedRuns, ...supplementalRuns],
    databaseInfo: metadata.databaseInfo,
    suiteMultipliers: metadata.suiteMultipliers,
    steadyStateSuiteMultiplier: metadata.steadyStateSuiteMultiplier,
    totalBenchmarkDurationMs: metadata.totalBenchmarkDurationMs,
    concurrencySummary: concurrencySummaryResult,
    benchProfileName: metadata.benchProfileName,
    benchScenarios: metadata.benchScenarios,
    warmupRuns: metadata.warmupRuns,
    measuredRuns: metadata.measuredRuns,
    steadyStateWarmups: metadata.steadyStateWarmups,
    steadyStateMeasuredRuns: metadata.steadyStateMeasuredRuns,
    parallelWorkerCounts: metadata.parallelWorkerCounts,
    benchConnectionModels: metadata.benchConnectionModels,
    traditionalDbSerialLock: metadata.traditionalDbSerialLock,
    reportPath,
    appendixReportPath,
    rootDir,
    supplementalResults: supplementalRuns.length > 0 ? supplementalRuns : undefined,
  });
  console.log(
    `ZTD analysis complete. Report: ${path.relative(
      ROOT_DIR,
      reportPath,
    )}; appendix: ${path.relative(ROOT_DIR, appendixReportPath)}.`,
  );
}
