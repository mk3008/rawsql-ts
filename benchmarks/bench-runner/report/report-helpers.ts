import { average, stddev } from '../utils';
import type { RunMetrics } from '../types';
import type { BenchPhaseEntry } from './report-model';

export function summarizeRuns(runs: RunMetrics[]) {
  const sqlCounts = runs
    .map((run) => run.sqlCount)
    .filter((count): count is number => typeof count === 'number');
  const totalDbTimes = runs
    .map((run) => run.totalDbMs)
    .filter((value): value is number => typeof value === 'number');
  const perStatementTimes = runs
    .map((run) =>
      typeof run.totalDbMs === 'number' && typeof run.sqlCount === 'number' && run.sqlCount > 0
        ? run.totalDbMs / run.sqlCount
        : undefined,
    )
    .filter((value): value is number => typeof value === 'number');

  return {
    averageDuration: average(runs.map((run) => run.durationMs)),
    stddevDuration: stddev(runs.map((run) => run.durationMs)),
    averageSqlCount: sqlCounts.length > 0 ? average(sqlCounts) : undefined,
    averageTotalDbMs: totalDbTimes.length > 0 ? average(totalDbTimes) : undefined,
    averagePerStatementMs: perStatementTimes.length > 0 ? average(perStatementTimes) : undefined,
    stddevPerStatementMs: perStatementTimes.length > 1 ? stddev(perStatementTimes) : 0,
  };
}

export function summarizeComponent(
  runs: RunMetrics[],
  selector: (run: RunMetrics) => number | undefined,
): { average?: number; stddev?: number } {
  const values = runs.map(selector).filter((value): value is number => typeof value === 'number');
  if (values.length === 0) {
    return {};
  }
  return {
    average: average(values),
    stddev: values.length > 1 ? stddev(values) : 0,
  };
}

export function averageOptional(values: Array<number | undefined>): number | undefined {
  const filtered = values.filter((value): value is number => typeof value === 'number');
  if (filtered.length === 0) {
    return undefined;
  }
  return average(filtered);
}

export function collectTraditionalMetric(
  entries: BenchPhaseEntry[],
  phaseName: string,
  metric: 'waitingMs' | 'durationMs' | 'cleanupMs',
): number[] {
  return entries
    .filter(
      (entry) =>
        entry.phase === phaseName &&
        entry.status === 'end' &&
        entry.context?.approach === 'traditional' &&
        entry.context.phase === 'measured' &&
        entry.context.mode === 'parallel' &&
        typeof entry[metric] === 'number',
    )
    .map((entry) => entry[metric] as number);
}
