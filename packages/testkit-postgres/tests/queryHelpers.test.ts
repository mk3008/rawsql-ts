import { describe, expect, it } from 'vitest';
import { alignRewrittenParameters } from '@rawsql-ts/testkit-core';

describe('placeholder normalization', () => {
  it('renumbers rewritten placeholders to be contiguous and drops gaps', () => {
    const sourceSql = 'select $3, $1, $5';
    const params = ['a', 'b', 'c', 'd', 'e'];

    const result = alignRewrittenParameters(sourceSql, params);
    const numbers = Array.from(result.sql.matchAll(/\$(\d+)/g)).map((match) => Number(match[1]));

    expect(numbers).toHaveLength(result.params?.length ?? 0);
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(Math.max(...numbers));
    expect(Math.min(...numbers)).toBe(1);
    expect(Math.max(...numbers) - Math.min(...numbers) + 1).toBe(uniqueNumbers.size);
    expect(result.params).toEqual(['a', 'c', 'e']);
  });
});
