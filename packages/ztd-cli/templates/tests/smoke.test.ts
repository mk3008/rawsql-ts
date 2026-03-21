import { expect, test } from 'vitest';

import { buildSmokeWorkflow } from '../src/features/smoke/application/smoke-workflow.js';
import { createTestkitClient, tableFixture } from './support/testkit-client.js';

test('smoke: first sanity check keeps the scaffold runnable', () => {
  const result = buildSmokeWorkflow({
    id: 1,
    createdAt: '2025-01-01T00:00:00.000Z'
  });

  expect(result.feature).toBe('smoke');
  expect(result.output.createdAt).toBeInstanceOf(Date);
  expect(result.output.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
});

test('smoke: SqlClient seam is the handoff point after the feature sample', async () => {
  const client = await createTestkitClient([
    tableFixture('users', [
      {
        user_id: 1,
        email: 'alice@example.com',
        display_name: 'Alice'
      }
    ])
  ]);

  const rows = await client.query(
    'select user_id, email, display_name from users where user_id = $1 order by user_id',
    [1]
  );

  expect(rows).toEqual([
    {
      user_id: 1,
      email: 'alice@example.com',
      display_name: 'Alice'
    }
  ]);
  await client.close();
});
