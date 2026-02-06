import { describe, expect, test } from 'vitest';
import { compileNamedParameters } from '@rawsql-ts/shared-binder';

describe('compileNamedParameters constraints', () => {
  test('ignores named markers inside string literals', () => {
    const sql = "select ':name' as literal, :id as value";
    const compiled = compileNamedParameters(sql, { id: 1, name: 'ignored' }, 'pg-indexed');

    expect(compiled.sql).toBe("select ':name' as literal, $1 as value");
    expect(compiled.values).toEqual([1]);
  });

  test('ignores named markers inside comments', () => {
    const sql = `
      select :id as value
      -- :ignored
      /* :also_ignored */
    `;
    const compiled = compileNamedParameters(sql, { id: 2 }, 'pg-indexed');

    expect(compiled.sql).toMatch(/select\s+\$1\s+as\s+value/i);
    expect(compiled.sql).toContain('-- :ignored');
    expect(compiled.sql).toContain('/* :also_ignored */');
    expect(compiled.values).toEqual([2]);
  });

  test('preserves postgres cast operator', () => {
    const sql = 'select :id::text as value';
    const compiled = compileNamedParameters(sql, { id: 3 }, 'pg-indexed');

    expect(compiled.sql).toBe('select $1::text as value');
    expect(compiled.values).toEqual([3]);
  });

  test('throws when a named parameter is missing', () => {
    const sql = 'select :missing as value';
    expect(() => compileNamedParameters(sql, {}, 'pg-indexed')).toThrowError(
      'Missing value for named parameter ":missing".',
    );
  });

  test('allows duplicate named parameters', () => {
    const sql = 'select :id as first, :id as second';
    const compiled = compileNamedParameters(sql, { id: 10 }, 'pg-indexed');

    expect(compiled.sql).toBe('select $1 as first, $2 as second');
    expect(compiled.values).toEqual([10, 10]);
    expect(compiled.orderedNames).toEqual(['id', 'id']);
  });

  test('allows extra params keys', () => {
    const sql = 'select :id as value';
    const compiled = compileNamedParameters(sql, { id: 1, extra: 'ok' }, 'pg-indexed');

    expect(compiled.sql).toBe('select $1 as value');
    expect(compiled.values).toEqual([1]);
  });
});
