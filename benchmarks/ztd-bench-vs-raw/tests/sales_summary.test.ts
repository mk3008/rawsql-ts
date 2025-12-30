import { describe, test } from 'vitest';
import { buildBenchSchemaName, resolveSuiteMultiplier } from './support/bench-suite';
import { runSalesSummaryCase } from './support/ztd-bench-cases';

const benchSuite = process.env.BENCH_STEADY_STATE === '1' ? describe.skip : describe;

benchSuite('sales_summary query', () => {
  const suiteMultiplier = resolveSuiteMultiplier();

  for (let iteration = 0; iteration < suiteMultiplier; iteration += 1) {
    test(`summarizes revenue per day (run ${iteration + 1})`, async () => {
      const schemaName = buildBenchSchemaName('sales_summary', `run_${iteration}`);
      await runSalesSummaryCase({ schemaName });
    });
  }
});
