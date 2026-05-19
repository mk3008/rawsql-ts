import { describe, expect, test, vi } from 'vitest';
import { compileDriverQuery, createRowsOnlySqlClient } from '../src';

describe('compileDriverQuery', () => {
  test('keeps positional values unchanged', () => {
    const compiled = compileDriverQuery('select $1 as value', [1], {
      placeholderStyle: 'pg-indexed',
    });

    expect(compiled).toEqual({
      text: 'select $1 as value',
      values: [1],
    });
  });

  test('compiles named params to pg indexed placeholders', () => {
    const compiled = compileDriverQuery(
      'select * from users where id = :id and status = :status',
      { id: 10, status: 'active' },
      { placeholderStyle: 'pg-indexed' }
    );

    expect(compiled.text).toBe('select * from users where id = $1 and status = $2');
    expect(compiled.values).toEqual([10, 'active']);
    expect(compiled.orderedNames).toEqual(['id', 'status']);
  });

  test('compiles named params to question placeholders', () => {
    const compiled = compileDriverQuery('select * from users where id = :id', { id: 10 }, {
      placeholderStyle: 'question',
    });

    expect(compiled.text).toBe('select * from users where id = ?');
    expect(compiled.values).toEqual([10]);
  });
});

describe('createRowsOnlySqlClient', () => {
  test('adapts rows-returning drivers and compiles named params', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 10 }] }));
    const client = createRowsOnlySqlClient({ query }, { placeholderStyle: 'pg-indexed' });

    const rows = await client.query<{ id: number }>('select * from users where id = :id', {
      id: 10,
    });

    expect(rows).toEqual([{ id: 10 }]);
    expect(query).toHaveBeenCalledWith('select * from users where id = $1', [10]);
  });
});
