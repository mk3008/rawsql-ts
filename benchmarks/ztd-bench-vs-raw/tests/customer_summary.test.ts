import { describe, test } from 'vitest';
import { buildBenchSchemaName, resolveSuiteMultiplier } from './support/bench-suite';
import { runCustomerSummaryCase } from './support/ztd-bench-cases';

const benchSuite = process.env.BENCH_STEADY_STATE === '1' ? describe.skip : describe;

benchSuite('customer_summary query', () => {
  const suiteMultiplier = resolveSuiteMultiplier();

  for (let iteration = 0; iteration < suiteMultiplier; iteration += 1) {
    test(`totals, spend, and last order appear for each customer (run ${iteration + 1})`, async () => {
      const schemaName = buildBenchSchemaName('customer_summary', `run_${iteration}`);
      await runCustomerSummaryCase({ schemaName });
    });
  }
});
