import { expect, test } from 'vitest';
import { runTraditionalParallelismValidation } from '../../../support/traditional-parallelism-validation';

const WORKER_COUNT = 4;

test('traditional parallelism validation observes concurrent pg_sleep work', async () => {
  const summary = await runTraditionalParallelismValidation({ workerCount: WORKER_COUNT });
  expect(summary.workerPids.size).toBe(WORKER_COUNT);
  expect(new Set(summary.workerPids.values()).size).toBe(WORKER_COUNT);
  expect(summary.maxActiveSessions).toBeGreaterThanOrEqual(WORKER_COUNT);
});
