import { expect, test } from 'vitest';

import { buildSmokeWorkflow } from '../src/features/smoke/application/smoke-workflow.js';
import { createTestkitClient } from './support/testkit-client.js';

test('smoke: first sanity check keeps the scaffold runnable', () => {
  const result = buildSmokeWorkflow({
    id: 1,
    createdAt: '2025-01-01T00:00:00.000Z'
  });

  expect(result.feature).toBe('smoke');
  expect(result.specFile).toBe('src/features/smoke/persistence/smoke.sql');
  expect(result.output.createdAt).toBeInstanceOf(Date);
});

test('smoke: SqlClient seam is the handoff point after the feature sample', async () => {
  const client = await createTestkitClient();
  expect(typeof client.query).toBe('function');
  await client.close();
});
