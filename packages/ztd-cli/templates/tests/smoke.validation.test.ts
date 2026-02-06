import { expect, test } from 'vitest';

import { ensureSmokeOutput } from '../src/catalog/runtime/_smoke.runtime';

test('validator invariant smoke passes for valid runtime output', () => {
  const output = ensureSmokeOutput({
    id: 1,
    createdAt: new Date('2025-01-01T00:00:00.000Z')
  });

  expect(output).toEqual({
    id: 1,
    createdAt: new Date('2025-01-01T00:00:00.000Z')
  });
});

test('validator invariant smoke normalizes valid timestamp strings', () => {
  const output = ensureSmokeOutput({
    id: 1,
    createdAt: '2025-01-01T00:00:00.000Z'
  });

  expect(output.createdAt).toBeInstanceOf(Date);
  expect(output.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
});

test('validator invariant smoke fails for invalid runtime output', () => {
  expect(() =>
    ensureSmokeOutput({
      id: 1,
      createdAt: 'not-a-date'
    })
  ).toThrow(/Invalid timestamp string/);
});
