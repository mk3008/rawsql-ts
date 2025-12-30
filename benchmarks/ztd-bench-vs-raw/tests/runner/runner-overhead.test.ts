import { expect, test } from 'vitest';

test('runner overhead noop', () => {
  // Intentionally empty to measure pure Vitest startup/execution overhead.
  expect(true).toBe(true);
});
