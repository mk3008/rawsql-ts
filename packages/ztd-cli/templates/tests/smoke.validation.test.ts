import { expect, test } from 'vitest';

import { executeCatalogQueryWithTrace, ensureSmokeOutput, type CatalogTraceEvent } from '../src/catalog/runtime/_smoke.runtime';

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

test('validator invariant smoke emits query_id trace event', async () => {
  const events: CatalogTraceEvent[] = [];
  const rows = await executeCatalogQueryWithTrace(
    {
      query_id: 'catalog.smoke.select',
      source: 'src/sql/smoke/select_smoke.sql',
      params: { id: 1 }
    },
    async () => [{ id: 1 }],
    (event) => {
      events.push(event);
    }
  );

  expect(rows).toHaveLength(1);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    query_id: 'catalog.smoke.select',
    phase: 'query.execute',
    row_count: 1,
    source: 'src/sql/smoke/select_smoke.sql'
  });
});
