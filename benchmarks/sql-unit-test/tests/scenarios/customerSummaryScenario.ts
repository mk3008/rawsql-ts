import assert from 'node:assert/strict';
import { CustomerSummaryRepository } from '../../src/customer_summary_repository';
import { buildFixtures, expectedRows } from '../support/customer-summary-fixtures';
import {
  createTestkitClient,
  type ZtdExecutionMode,
  type ZtdSqlLogOptions,
} from '../support/testkit-client';

export type CustomerSummaryScenarioOptions = Omit<ZtdSqlLogOptions, 'mode'>;

export type ScenarioInstrumentation = {
  recordStage(stage: string, durationMs: number): void;
};

export async function runCustomerSummaryScenario(
  mode: ZtdExecutionMode,
  options: CustomerSummaryScenarioOptions = {},
  instrumentation?: ScenarioInstrumentation,
): Promise<void> {
  const fixtures = buildFixtures();
  const connectionStart = performance.now();
  const client = await createTestkitClient(fixtures, { mode, ...options });
  instrumentation?.recordStage('connection', performance.now() - connectionStart);

  try {
    const repository = new CustomerSummaryRepository(client);
    const queryStart = performance.now();
    const rows = await repository.customerSummary();
    instrumentation?.recordStage('query', performance.now() - queryStart);

    const verifyStart = performance.now();
    assert.deepStrictEqual(rows, expectedRows);
    instrumentation?.recordStage('verify', performance.now() - verifyStart);
  } finally {
    const cleanupStart = performance.now();
    await client.close();
    instrumentation?.recordStage('cleanup', performance.now() - cleanupStart);
  }
}
