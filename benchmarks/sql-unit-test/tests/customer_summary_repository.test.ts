import { describe, expect, test } from 'vitest';
import { runCustomerSummaryScenario } from './scenarios/customerSummaryScenario';

describe('[ztd]CustomerSummaryRepository', () => {
  test('returns aggregated totals for each customer', async () => {
    await runCustomerSummaryScenario('ztd');
  });
});

describe('[traditional]CustomerSummaryRepository', () => {
  test('returns aggregated totals for each customer', async () => {
    await runCustomerSummaryScenario('traditional');
  });
});
