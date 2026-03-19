import { expect, test } from 'vitest';

import { ensureSmokeOutput } from '../src/catalog/runtime/_smoke.runtime.js';
import { createTestkitClient, tableFixture } from './support/testkit-client.js';

test('smoke: first sanity check keeps the scaffold runnable', () => {
  const output = ensureSmokeOutput({
    id: 1,
    createdAt: '2025-01-01T00:00:00.000Z'
  });

  expect(output.id).toBe(1);
  expect(output.createdAt).toBeInstanceOf(Date);
  expect(output.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
});

test('smoke: SqlClient seam is the handoff point after the QuerySpec sample', async () => {
  const client = await createTestkitClient();
  expect(typeof client.query).toBe('function');
  await client.close();
});

test('smoke: fixture-backed rewrite works without CREATE TABLE', async () => {
  const client = await createTestkitClient([
    tableFixture(
      'public.user',
      [
        {
          user_id: 1,
          user_name: 'Alice',
          email: 'alice@example.com',
          created_at: '2025-01-01T00:00:00.000Z'
        }
      ]
    )
  ]);

  try {
    const rows = await client.query<{
      user_id: number;
      user_name: string;
    }>('SELECT user_id, user_name FROM "user" WHERE user_id = $1', [1]);

    expect(rows).toEqual([
      {
        user_id: 1,
        user_name: 'Alice'
      }
    ]);
  } finally {
    await client.close();
  }
});
