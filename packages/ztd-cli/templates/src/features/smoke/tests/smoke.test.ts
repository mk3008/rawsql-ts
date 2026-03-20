import { expect, test } from 'vitest';

import { buildSmokeWorkflow } from '../application/smoke-workflow.js';

test('smoke feature keeps the sample workflow aligned', () => {
  const result = buildSmokeWorkflow({
    id: 1,
    createdAt: '2025-01-01T00:00:00.000Z'
  });

  expect(result.feature).toBe('smoke');
  expect(result.output.createdAt).toBeInstanceOf(Date);
  expect(result.output.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
});
