import { expect, test, vi } from 'vitest';

import { fromPg } from '../templates/src/adapters/pg/sql-client';

test('fromPg unwraps QueryResult.rows from the underlying pg queryable', async () => {
  const queryable = {
    query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] })
  };

  const client = fromPg(queryable);
  const rows = await client.query<{ id: number }>('select id from users where team_id = $1', [7]);

  expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  expect(queryable.query).toHaveBeenCalledWith('select id from users where team_id = $1', [7]);
});

test('fromPg forwards queries without values to the underlying pg queryable', async () => {
  const queryable = {
    query: vi.fn().mockResolvedValue({ rows: [{ ok: true }] })
  };

  const client = fromPg(queryable);
  const rows = await client.query<{ ok: boolean }>('select true as ok');

  expect(rows).toEqual([{ ok: true }]);
  expect(queryable.query).toHaveBeenCalledWith('select true as ok', undefined);
});
