import { expect, test } from 'vitest';

import { buildSmokeWorkflow } from '../application/smoke-workflow.js';

test('smoke feature adds two numbers through the application workflow', () => {
  const result = buildSmokeWorkflow({
    left: 2,
    right: 3
  });

  expect(result.feature).toBe('smoke');
  expect(result.output).toEqual({ sum: 5 });
});
