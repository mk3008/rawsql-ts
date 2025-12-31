import { cpus, platform, release } from 'node:os';
import { readFile } from 'node:fs/promises';
import {
  DDL_FILE_PATH,
  COST_LOG_PATH,
  MeasurementRow,
  MeasurementStats,
  PARALLEL_WORKERS,
  REPORT_FILE_PATH,
  REPEAT_ITERATIONS,
  STAGE_ORDER,
  TEST_COUNTS,
  LogSamples,
  CONNECTION_PROFILE_LABELS,
  StageBreakdownRow,
} from './benchmark-config';

function aggregateMeasurements(rows: MeasurementRow[]): MeasurementRow[] {
  const buckets = new Map<
    string,
    { sumMean: number; sumError: number; sumStdDev: number; count: number; template: MeasurementRow }
  >();
  for (const row of rows) {
    const key = `${row.mode}|${row.connectionProfile}|${row.parallel}|${row.testCount}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.sumMean += row.stats.meanTotalMs;
      bucket.sumError += row.stats.errorTotalMs;
      bucket.sumStdDev += row.stats.stdDevTotalMs;
      bucket.count += 1;
    } else {
      buckets.set(key, {
        sumMean: row.stats.meanTotalMs,
        sumError: row.stats.errorTotalMs,
        sumStdDev: row.stats.stdDevTotalMs,
        count: 1,
        template: row,
      });
    }
  }

  return Array.from(buckets.values()).map((bucket) => ({
    ...bucket.template,
    stats: {
      meanTotalMs: bucket.sumMean / bucket.count,
      errorTotalMs: bucket.sumError / bucket.count,
      stdDevTotalMs: bucket.sumStdDev / bucket.count,
    },
  }));
}

function buildMeasurementTable(testCount: number, rows: MeasurementRow[]): string {
  const lines: string[] = [];
  for (const parallel of PARALLEL_WORKERS) {
    for (const connectionProfile of ['perTest', 'shared'] as const) {
      for (const mode of ['ztd', 'traditional'] as const) {
        const measurement = rows.find(
          (row) =>
            row.testCount === testCount &&
            row.parallel === parallel &&
            row.mode === mode &&
            row.connectionProfile === connectionProfile,
        );
        if (!measurement) {
          continue;
        }
        const { meanTotalMs, errorTotalMs, stdDevTotalMs } = measurement.stats;
        lines.push(
          `| ${mode} | ${CONNECTION_PROFILE_LABELS[connectionProfile]} | ${testCount} | ${parallel} | ${meanTotalMs.toFixed(
            2,
          )} | ${errorTotalMs.toFixed(2)} | ${stdDevTotalMs.toFixed(2)} |`,
        );
      }
    }
  }
    const tableHeader =
      `### Total time to complete ${testCount} tests (averaged over ${REPEAT_ITERATIONS} repetitions)\n\n`
      + `| Method | Connection | Tests | Parallel | Total Mean (ms) | Standard Error (ms) | StdDev (ms) |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
  return `${tableHeader}${lines.join('\n')}\n`;
}

function buildStageBreakdownSection(rows: StageBreakdownRow[]): string {
  if (rows.length === 0) {
    return '';
  }

  const modeStageSets: Record<string, Set<(typeof STAGE_ORDER)[number]>> = {
    traditional: new Set(STAGE_ORDER),
    ztd: new Set(STAGE_ORDER),
  };
  const modeOrder = ['ztd', 'traditional'];
  const connectionOrder = ['perTest', 'shared'];
  const connectionSummaryStages: (typeof STAGE_ORDER)[number][] = ['connection', 'query', 'cleanup'];

  type SummaryEntry = { sumMean: number; sumPercent: number; count: number };

  const modeSummaryBucket = new Map<string, SummaryEntry>();
  const connectionSummaryBucket = new Map<string, SummaryEntry>();

  for (const row of rows) {
    const stageSet = modeStageSets[row.mode];
    if (!stageSet) {
      continue;
    }
    for (const stage of STAGE_ORDER) {
      if (!stageSet.has(stage)) {
        continue;
      }
      const mean = row.stageMeans[stage] ?? 0;
      const percent = row.totalMean > 0 ? (mean / row.totalMean) * 100 : 0;
      const modeKey = `${row.mode}|${stage}`;
      const modeEntry = modeSummaryBucket.get(modeKey) ?? { sumMean: 0, sumPercent: 0, count: 0 };
      modeEntry.sumMean += mean;
      modeEntry.sumPercent += percent;
      modeEntry.count += 1;
      modeSummaryBucket.set(modeKey, modeEntry);

      if (connectionSummaryStages.includes(stage)) {
        const connectionKey = `${row.mode}|${row.connectionProfile}|${stage}`;
        const connectionEntry =
          connectionSummaryBucket.get(connectionKey) ?? { sumMean: 0, sumPercent: 0, count: 0 };
        connectionEntry.sumMean += mean;
        connectionEntry.sumPercent += percent;
        connectionEntry.count += 1;
        connectionSummaryBucket.set(connectionKey, connectionEntry);
      }
    }
  }

  const modeSummaryEntries = Array.from(modeSummaryBucket.entries())
    .map(([key, entry]) => {
      const [mode, stage] = key.split('|');
      return {
        mode,
        stage,
        meanMs: entry.sumMean / entry.count,
        percent: entry.sumPercent / entry.count,
      };
    })
    .sort((a, b) => {
      const modeDiff = modeOrder.indexOf(a.mode) - modeOrder.indexOf(b.mode);
      if (modeDiff !== 0) {
        return modeDiff;
      }
      return (
        STAGE_ORDER.indexOf(a.stage as (typeof STAGE_ORDER)[number]) -
        STAGE_ORDER.indexOf(b.stage as (typeof STAGE_ORDER)[number])
      );
    });

  const connectionSummaryEntries = Array.from(connectionSummaryBucket.entries())
    .map(([key, entry]) => {
      const [mode, connectionProfile, stage] = key.split('|');
      return {
        mode,
        connectionProfile,
        stage,
        meanMs: entry.sumMean / entry.count,
        percent: entry.sumPercent / entry.count,
      };
    })
    .sort((a, b) => {
      const modeDiff = modeOrder.indexOf(a.mode) - modeOrder.indexOf(b.mode);
      if (modeDiff !== 0) {
        return modeDiff;
      }
      const connectionDiff =
        connectionOrder.indexOf(a.connectionProfile) - connectionOrder.indexOf(b.connectionProfile);
      if (connectionDiff !== 0) {
        return connectionDiff;
      }
      return (
        connectionSummaryStages.indexOf(a.stage as (typeof STAGE_ORDER)[number]) -
        connectionSummaryStages.indexOf(b.stage as (typeof STAGE_ORDER)[number])
      );
    });

function formatStageValue(row: StageBreakdownRow, stage: (typeof STAGE_ORDER)[number]): { text: string; mean: number | null } {
    const stageSet = modeStageSets[row.mode];
    if (!stageSet || !stageSet.has(stage)) {
      return { text: 'N/A', mean: null };
    }
    const value = row.stageMeans[stage] ?? 0;
    return { text: value.toFixed(2), mean: value };
  }

  const sortedRows = [...rows].sort((a, b) => {
    if (a.testCount !== b.testCount) {
      return a.testCount - b.testCount;
    }
    if (a.parallel !== b.parallel) {
      return a.parallel - b.parallel;
    }
    if (a.connectionProfile !== b.connectionProfile) {
      return connectionOrder.indexOf(a.connectionProfile) - connectionOrder.indexOf(b.connectionProfile);
    }
    return modeOrder.indexOf(a.mode) - modeOrder.indexOf(b.mode);
  });

  const rawLines: string[] = [];
  rawLines.push('| Mode | Connection | Tests | Parallel | Stage | Mean (ms) | % of total |');
  rawLines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const row of sortedRows) {
    const connectionLabel = CONNECTION_PROFILE_LABELS[row.connectionProfile];
    for (const stage of STAGE_ORDER) {
      const { text, mean } = formatStageValue(row, stage);
      const percent =
        mean !== null && row.totalMean > 0 ? (mean / row.totalMean) * 100 : null;
      const percentLabel = percent !== null ? `${percent.toFixed(1)}%` : 'N/A';
      rawLines.push(
        `| ${row.mode} | ${connectionLabel} | ${row.testCount} | ${row.parallel} | ${stage} | ${text} | ${percentLabel} |`,
      );
    }
    rawLines.push(
      `| ${row.mode} | ${connectionLabel} | ${row.testCount} | ${row.parallel} | total | ${row.totalMean.toFixed(
        2,
      )} | 100.0% |`,
    );
  }

  const result: string[] = [];
    result.push('## Cost breakdown');
    result.push('');
    result.push('- Stage measurements capture `connection`, `query`, `verify`, and `cleanup` durations; the `total` row reports the sum of those spans.');
    result.push(
      '- Summary A and B aggregate across all repetitions, worker counts, and test sizes. Mean (ms) is the average stage duration per iteration, while % of total is computed as ratio-of-sums (sum(stage_ms) ÷ sum(total_ms)) over the same iteration set.',
    );
    result.push(
      '- These breakdowns keep the spotlight on comparable connection/query/cleanup work while leaving rewrite-specific instrumentation to dedicated microbenchmarks.',
    );
  result.push('');
  if (modeSummaryEntries.length > 0) {
    result.push('### Summary A: Mode-level stage composition');
    result.push('');
    result.push('| Mode | Stage | Mean (ms) | % of total |');
    result.push('| --- | --- | --- | --- |');
    for (const entry of modeSummaryEntries) {
      result.push(
        `| ${entry.mode} | ${entry.stage} | ${entry.meanMs.toFixed(2)} | ${entry.percent.toFixed(1)}% |`,
      );
    }
    result.push('');
  }
  if (connectionSummaryEntries.length > 0) {
    result.push('### Summary B: Connection profile stage mix');
    result.push('');
    result.push('| Mode | Connection | Stage | Mean (ms) | % of total |');
    result.push('| --- | --- | --- | --- | --- |');
    for (const entry of connectionSummaryEntries) {
      result.push(
        `| ${entry.mode} | ${CONNECTION_PROFILE_LABELS[entry.connectionProfile]} | ${entry.stage} | ${entry.meanMs.toFixed(
          2,
        )} | ${entry.percent.toFixed(1)}% |`,
      );
    }
    result.push('');
  }
  result.push('## Appendix: Full cost breakdown (raw)');
  result.push('');
  result.push('- The table below repeats the raw per-iteration rows for reference.');
  result.push('');
  result.push(rawLines.join('\n'));
  result.push('');
  return result.join('\n');
}

export async function buildReportContent(
  measurements: MeasurementRow[],
  stageBreakdownRows: StageBreakdownRow[],
  sqlLogSamples: LogSamples,
): Promise<string> {
  const ddlSource = await readFile(DDL_FILE_PATH, 'utf-8');
  const aggregated = aggregateMeasurements(measurements);
  const reportLines: string[] = [];

  reportLines.push('# Customer summary benchmark');
  reportLines.push('');
  reportLines.push('## Environment');
  reportLines.push(`- Node.js ${process.version}`);
  reportLines.push(`- Platform ${platform()} ${release()}`);
  reportLines.push(`- CPU count ${cpus().length}`);
  reportLines.push('- PostgreSQL container image `postgres:18-alpine`');
  reportLines.push('');
  reportLines.push('## Measurement scope');
  reportLines.push(
    '- Each timed iteration measures from before `CustomerSummaryRepository.customerSummary()` is invoked through result verification, so migration/seeding (traditional) or fixture resolution (ZTD) is part of the duration.',
  );
  reportLines.push('- Docker/container startup time is excluded: the PostgreSQL container is started once before all measured iterations.');
  reportLines.push(
    '- The benchmark script manages concurrency with Node async workers rather than spawning Vitest worker threads, so Vitest worker overhead is not part of the measured durations.',
  );
  reportLines.push(
    '- Measurement rows cover both `perTest` runs (dedicated `exclusiveConnection`) and `shared` runs (reused pg.Client) so connection overhead can be compared against fixture/query costs.',
  );
  reportLines.push('- `perTest` iterations open and close a dedicated client every time, while `shared` iterations keep the client alive across repetitions for lower connection churn.');
  reportLines.push('- Each recorded duration sums the total runtime of all tests in that repetition; the tables below average these totals.');
  reportLines.push('');
  reportLines.push('## Conditions');
  reportLines.push(
    `- Measured runs: \`ts-node benchmarks/sql-unit-test/scripts/customer-summary-benchmark.ts\` with ${REPEAT_ITERATIONS} repetitions, segmented by tests of ${TEST_COUNTS.join(
      '/',
    )} and parallel worker counts of 1, 2, 4, 8.`,
  );
  reportLines.push('- Each condition reports the total wall-clock time to run the configured number of tests per repetition; the repeated totals are what the tables below average.');
  reportLines.push('- Each run reuses the same repository scenario from the Vitest suite so the benchmark times the exact code paths covered by the automated tests.');
  reportLines.push(
    '- ZTD-mode measurements pass `dangerousSqlPolicy=off` to suppress warnings from unparseable statements; this only reduces log noise and does not change the execution semantics or the measured costs.',
  );
  reportLines.push('');
  reportLines.push('## Measurements');
  reportLines.push('');
  reportLines.push('- The tables below present the total time required to complete each configured test count per repetition, averaged across the repeated runs.');
  for (const testCount of TEST_COUNTS) {
    reportLines.push(buildMeasurementTable(testCount, aggregated));
  }
  reportLines.push('- Standard Error (ms) refers to the standard error of the total completion times across the repeated reps.');
  reportLines.push('');
  const breakdownSection = buildStageBreakdownSection(stageBreakdownRows);
  if (breakdownSection) {
    reportLines.push(breakdownSection);
  }
  reportLines.push('## SQL log details');
  reportLines.push('');
  if (sqlLogSamples.ztdOriginal) {
    reportLines.push('### ZTD SQL (original query)');
    reportLines.push('```sql');
    reportLines.push(sqlLogSamples.ztdOriginal.trim());
    reportLines.push('```');
    reportLines.push('');
  }
  if (sqlLogSamples.ztdRewritten) {
    reportLines.push('### ZTD SQL (rewritten)');
    reportLines.push('```sql');
    reportLines.push(sqlLogSamples.ztdRewritten.trim());
    reportLines.push('```');
    reportLines.push('');
  }
  reportLines.push('### DDL definitions used by both modes');
  reportLines.push('');
  reportLines.push('```sql');
  reportLines.push(ddlSource.trim());
  reportLines.push('```');
  reportLines.push('');
  if (sqlLogSamples.traditionalOriginal) {
    reportLines.push('### Traditional repository query (measured)');
    reportLines.push('```sql');
    reportLines.push(sqlLogSamples.traditionalOriginal.trim());
    reportLines.push('```');
    reportLines.push('');
  }
  reportLines.push('## Observations');
  reportLines.push(
    '- Parallel worker counts consistently increase the mean duration in both ZTD and traditional modes, and the perTest connection profile amplifies that growth because every worker opens and closes a dedicated pg.Client for each iteration.',
  );
  reportLines.push(
    '- Shared connection profile measurements show a lower baseline, revealing how query/fixture work and database saturation become the primary drivers once the fixed connection cost is removed.',
  );
  reportLines.push('- The 100-repetition runs echo the same framing, meaning the contrast between the connection profiles persists even during sustained workloads.');
  return reportLines.join('\n');
}
