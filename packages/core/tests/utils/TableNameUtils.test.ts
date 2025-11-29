import { describe, it, expect } from 'vitest';
import { normalizeTableName, tableNameVariants } from '../../src/utils/TableNameUtils';

describe('TableNameUtils', () => {
    it('normalizes quoted and unquoted identifiers to the same key', () => {
        const names = ['users', '"users"', '`users`', '[users]'];
        const normalized = names.map(normalizeTableName);
        expect(new Set(normalized).size).toBe(1);
        expect(normalized[0]).toBe('users');
    });

    it('keeps schema qualifiers intact', () => {
        const value = normalizeTableName('public."users"');
        expect(value).toBe('public.users');
    });

    it('returns a single variant for strict schema-aware matching', () => {
        expect(tableNameVariants('public.users')).toEqual(['public.users']);
    });
});
