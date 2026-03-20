import { expect, test } from 'vitest';

import { normalizeSmokeOutput } from '../domain/smoke-policy.js';

test('smoke feature normalizes valid timestamp strings', () => {
  const output = normalizeSmokeOutput({
    id: 1,
    createdAt: '2025-01-01T00:00:00.000Z'
  });

  expect(output.createdAt).toBeInstanceOf(Date);
  expect(output.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
});

test('smoke feature rejects invalid timestamps', () => {
  expect(() =>
    normalizeSmokeOutput({
      id: 1,
      createdAt: 'not-a-date'
    })
  ).toThrow(/Invalid timestamp string/);
});
