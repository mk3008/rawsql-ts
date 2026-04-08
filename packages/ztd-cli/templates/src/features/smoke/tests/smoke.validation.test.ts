import { expect, test } from 'vitest';

import { addSmokeNumbers } from '../domain/smoke-policy.js';

test('smoke feature adds positive numbers in the domain layer', () => {
  const output = addSmokeNumbers({
    left: 1,
    right: 4
  });

  expect(output).toEqual({ sum: 5 });
});

test('smoke feature adds negative numbers in the domain layer', () => {
  const output = addSmokeNumbers({
    left: -2,
    right: 5
  });

  expect(output).toEqual({ sum: 3 });
});
