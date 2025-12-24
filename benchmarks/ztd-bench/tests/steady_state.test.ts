import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'vitest';
import type { ZtdBenchMetrics } from './support/testkit-client';
import { buildBenchSchemaName, resolveSuiteMultiplier } from './support/bench-suite';
import {
  runCustomerSummaryCase,
  runProductRankingCase,
  runSalesSummaryCase,
} from './support/ztd-bench-cases';

type SteadyStateMetricsFile = {
  iterationTotalMs: number[];
  iterationSqlCount: number[];
  iterationDbMs: number[];
  iterationRewriteMs: number[];
  iterationFixtureMs: number[];
  iterationSqlGenerationMs: number[];
  iterationOtherMs: number[];
};

const benchSuite = process.env.BENCH_STEADY_STATE === '1' ? describe : describe.skip;

function resolveIterations(): number {
  const raw = Number(process.env.ITERATIONS ?? 10);
  if (!Number.isFinite(raw) || raw < 1) {
    return 10;
  }
  return Math.floor(raw);
}

benchSuite('ZTD steady-state benchmark', () => {
  test('runs the suite repeatedly within a warm runner', async () => {
    const metricsPrefix = process.env.ZTD_BENCH_METRICS_PREFIX;
    if (!metricsPrefix) {
      throw new Error('ZTD_BENCH_METRICS_PREFIX is required for steady-state benchmarks.');
    }

    const iterations = resolveIterations();
    const suiteMultiplier = resolveSuiteMultiplier();
    const metricsFile: SteadyStateMetricsFile = {
      iterationTotalMs: [],
      iterationSqlCount: [],
      iterationDbMs: [],
      iterationRewriteMs: [],
      iterationFixtureMs: [],
      iterationSqlGenerationMs: [],
      iterationOtherMs: [],
    };

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const iterationTotals = {
        sqlCount: 0,
        totalDbMs: 0,
        rewriteMs: 0,
        fixtureMaterializationMs: 0,
        sqlGenerationMs: 0,
        otherProcessingMs: 0,
      };

      const collectMetrics = (metrics: ZtdBenchMetrics) => {
        iterationTotals.sqlCount += metrics.sqlCount;
        iterationTotals.totalDbMs += metrics.totalDbMs;
        iterationTotals.rewriteMs += metrics.rewriteMs;
        iterationTotals.fixtureMaterializationMs += metrics.fixtureMaterializationMs;
        iterationTotals.sqlGenerationMs += metrics.sqlGenerationMs;
        iterationTotals.otherProcessingMs += metrics.otherProcessingMs;
      };

      const iterationStart = process.hrtime.bigint();

      for (let repetition = 0; repetition < suiteMultiplier; repetition += 1) {
        // Stamp a unique fixture namespace for every repetition in the steady loop.
        const token = `iter_${iteration}_rep_${repetition}`;
        await runCustomerSummaryCase({
          schemaName: buildBenchSchemaName('customer_summary', token),
          metricsCollector: collectMetrics,
        });
        await runProductRankingCase({
          schemaName: buildBenchSchemaName('product_ranking', token),
          metricsCollector: collectMetrics,
        });
        await runSalesSummaryCase({
          schemaName: buildBenchSchemaName('sales_summary', token),
          metricsCollector: collectMetrics,
        });
      }

      const iterationTotalMs = Number(process.hrtime.bigint() - iterationStart) / 1_000_000;

      // Skip the first iteration to avoid measuring cold-start effects.
      if (iteration === 0) {
        continue;
      }

      metricsFile.iterationTotalMs.push(iterationTotalMs);
      metricsFile.iterationSqlCount.push(iterationTotals.sqlCount);
      metricsFile.iterationDbMs.push(iterationTotals.totalDbMs);
      metricsFile.iterationRewriteMs.push(iterationTotals.rewriteMs);
      metricsFile.iterationFixtureMs.push(iterationTotals.fixtureMaterializationMs);
      metricsFile.iterationSqlGenerationMs.push(iterationTotals.sqlGenerationMs);
      metricsFile.iterationOtherMs.push(iterationTotals.otherProcessingMs);
    }

    const metricsPath = `${metricsPrefix}-steady.json`;
    fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
    fs.writeFileSync(metricsPath, JSON.stringify(metricsFile, null, 2), 'utf8');
  });
});
