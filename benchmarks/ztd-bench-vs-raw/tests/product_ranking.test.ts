import { describe, test } from 'vitest';
import { buildBenchSchemaName, resolveSuiteMultiplier } from './support/bench-suite';
import { runProductRankingCase } from './support/ztd-bench-cases';

const benchSuite = process.env.BENCH_STEADY_STATE === '1' ? describe.skip : describe;

benchSuite('product_ranking query', () => {
  const suiteMultiplier = resolveSuiteMultiplier();

  for (let iteration = 0; iteration < suiteMultiplier; iteration += 1) {
    test(`ranks products by total revenue and units (run ${iteration + 1})`, async () => {
      const schemaName = buildBenchSchemaName('product_ranking', `run_${iteration}`);
      await runProductRankingCase({ schemaName });
    });
  }
});
