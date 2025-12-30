import fs from 'node:fs';
import path from 'node:path';
import type { BenchProfileName, ExecutionMode, MetricsStatusEntry, RunMetrics, Scenario, SteadyStateMetrics } from '../types';
import type { RunPhase } from '../../ztd-bench-vs-raw/tests/support/diagnostics';

type MetricsContext = {
  rootDir: string;
  benchProfileName: BenchProfileName;
};

let metricsContext: MetricsContext | null = null;

export function configureMetricsContext(context: MetricsContext): void {
  metricsContext = context;
}

function requireMetricsContext(): MetricsContext {
  if (!metricsContext) {
    throw new Error('Metrics context has not been configured.');
  }
  return metricsContext;
}

const METRICS_STATUS_LOG: MetricsStatusEntry[] = [];

export function clearMetricsStatus(): void {
  METRICS_STATUS_LOG.length = 0;
}

function logMetricsStatus(entry: MetricsStatusEntry): void {
  METRICS_STATUS_LOG.push(entry);
}

export function getMetricsStatusEntries(): MetricsStatusEntry[] {
  return [...METRICS_STATUS_LOG];
}

function normalizeMissingEntries(entries: string[]): string[] {
  return Array.from(new Set(entries.filter((entry) => entry.length > 0)));
}

// Track which metric files were produced and optionally escalate on missing data.
export function recordMetricsStatus(
  scenario: Scenario,
  mode: ExecutionMode,
  suiteMultiplier: number,
  phase: RunPhase,
  runIndex: number,
  usedFiles: string[],
  missingFiles: string[],
): void {
  const { rootDir, benchProfileName } = requireMetricsContext();
  const normalizedMissing = normalizeMissingEntries(missingFiles);
  const relativeUsedFiles = usedFiles.map((filePath) => path.relative(rootDir, filePath));
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
  warnOrFailOnMissingMetrics(entry, benchProfileName);
}

// Decide whether missing metric files should fail CI or just warn for developer runs.
function warnOrFailOnMissingMetrics(entry: MetricsStatusEntry, benchProfileName: BenchProfileName): void {
  if (entry.missingFiles.length === 0) {
    return;
  }
  const descriptor = `${entry.scenario} (${entry.mode}) multiplier ${entry.suiteMultiplier} ${entry.phase} run ${entry.runIndex}`;
  const message = `Metrics incomplete for ${descriptor}: missing ${entry.missingFiles.join(', ')}.`;
  if (benchProfileName === 'ci') {
    throw new Error(message);
  }
  console.warn(message);
}

export function clearMetricsFiles(prefix: string): void {
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

export function aggregateTraditionalMetrics(prefix: string, mode: ExecutionMode): MetricsAggregateResult {
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

export function readExecutionMetrics(prefix: string): number | undefined {
  const filePath = `${prefix}-execution.json`;
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const metrics = JSON.parse(raw) as { executionMs?: number };
  return typeof metrics.executionMs === 'number' ? metrics.executionMs : undefined;
}

export function readSteadyStateMetrics(prefix: string): SteadyStateMetrics | undefined {
  const filePath = `${prefix}-steady.json`;
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as SteadyStateMetrics;
}

export function loadRunMetricsFromDisk(tmpDir: string, runTagPrefix = ''): RunMetrics[] {
  if (!fs.existsSync(tmpDir)) {
    return [];
  }

  const results: RunMetrics[] = [];
  for (const entry of fs.readdirSync(tmpDir)) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    if (runTagPrefix.length > 0 && !entry.startsWith(runTagPrefix)) {
      continue;
    }

    const filePath = path.join(tmpDir, entry);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<RunMetrics>;
    if (parsed.scenario && parsed.mode && typeof parsed.durationMs === 'number') {
      results.push(parsed as RunMetrics);
    }
  }

  return results;
}
