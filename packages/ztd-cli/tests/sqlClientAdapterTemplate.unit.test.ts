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

test('fromPg rejects named parameter objects before calling the underlying queryable', () => {
  const queryable = {
    query: vi.fn()
  };

  const client = fromPg(queryable);

  expect(() => client.query('select id from users where id = :id', { id: 7 })).toThrowError(
    'fromPg adapter does not support named parameter objects; use positional parameter arrays'
  );
  expect(queryable.query).not.toHaveBeenCalled();
});
