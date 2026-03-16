import { expect, test } from 'vitest';

import { ensureSmokeOutput } from '../src/catalog/runtime/_smoke.runtime.js';
import { createTestkitClient } from './support/testkit-client.js';

test('smoke: runtime contract wiring is usable before SQL-backed tests exist', () => {
  const output = ensureSmokeOutput({
    id: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
  });

  expect(output.id).toBe(1);
  expect(output.createdAt).toBeInstanceOf(Date);
  expect(output.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
});

test('smoke: SqlClient seam is either wired or fails with an actionable message', async () => {
  try {
    const client = await createTestkitClient();
    expect(typeof client.query).toBe('function');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain('Provide a SqlClient implementation here');
  }
});
