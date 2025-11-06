import { describe, expect, it } from 'vitest';
import { AnalyzeStatementParser } from '../../src/parsers/AnalyzeStatementParser';
import { AnalyzeStatement } from '../../src/models/DDLStatements';
import { IdentifierString } from '../../src/models/ValueComponent';

describe('AnalyzeStatementParser', () => {
    it('parses minimal ANALYZE statement', () => {
        const statement = AnalyzeStatementParser.parse('ANALYZE');

        expect(statement).toBeInstanceOf(AnalyzeStatement);
        expect(statement.verbose).toBe(false);
        expect(statement.target).toBeNull();
        expect(statement.columns).toBeNull();
    });

    it('parses ANALYZE VERBOSE with qualified target', () => {
        const statement = AnalyzeStatementParser.parse('ANALYZE VERBOSE public.users');

        expect(statement.verbose).toBe(true);
        expect(statement.target).not.toBeNull();
        if (!statement.target) {
            throw new Error('Expected target to be parsed.');
        }
        const namespaces = statement.target.namespaces?.map(ns => ns.name) ?? null;
        expect(namespaces).toEqual(['public']);
        const tableName = statement.target.name;
        if (tableName instanceof IdentifierString) {
            expect(tableName.name).toBe('users');
        } else {
            expect(tableName.value).toBe('users');
        }
    });

    it('parses ANALYZE with column list', () => {
        const statement = AnalyzeStatementParser.parse('ANALYZE users (id, name)');

        expect(statement.target).not.toBeNull();
        expect(statement.columns).not.toBeNull();
        if (!statement.columns) {
            throw new Error('Expected columns to be parsed.');
        }
        expect(statement.columns.map(col => col.name)).toEqual(['id', 'name']);
    });

    it('throws when column list appears without target', () => {
        expect(() => AnalyzeStatementParser.parse('ANALYZE (id)')).toThrow(/requires a target relation/i);
    });
});
