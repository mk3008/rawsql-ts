import { describe, test, expect } from 'vitest';
import { BinarySelectQuery, SimpleSelectQuery } from '../../src/models/SelectQuery';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';

describe('BinarySelectQuery Raw SQL Methods', () => {
    const formatter = new Formatter();

    test('unionRaw works with SQL string', () => {
        const left = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;
        const binary = new BinarySelectQuery(left, 'union', left);
        const result = binary.unionRaw('SELECT id FROM admins');
        expect(result).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.format(result)).toContain('union select "id" from "admins"');
    });

    test('unionAllRaw works with SQL string', () => {
        const left = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;
        const binary = new BinarySelectQuery(left, 'union', left);
        const result = binary.unionAllRaw('SELECT id FROM admins');
        expect(result).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.format(result)).toContain('union all select "id" from "admins"');
    });

    test('intersectRaw works with SQL string', () => {
        const left = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;
        const binary = new BinarySelectQuery(left, 'union', left);
        const result = binary.intersectRaw('SELECT id FROM admins');
        expect(result).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.format(result)).toContain('intersect select "id" from "admins"');
    });

    test('intersectAllRaw works with SQL string', () => {
        const left = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;
        const binary = new BinarySelectQuery(left, 'union', left);
        const result = binary.intersectAllRaw('SELECT id FROM admins');
        expect(result).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.format(result)).toContain('intersect all select "id" from "admins"');
    });

    test('exceptRaw works with SQL string', () => {
        const left = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;
        const binary = new BinarySelectQuery(left, 'union', left);
        const result = binary.exceptRaw('SELECT id FROM admins');
        expect(result).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.format(result)).toContain('except select "id" from "admins"');
    });

    test('exceptAllRaw works with SQL string', () => {
        const left = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;
        const binary = new BinarySelectQuery(left, 'union', left);
        const result = binary.exceptAllRaw('SELECT id FROM admins');
        expect(result).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.format(result)).toContain('except all select "id" from "admins"');
    });
});
