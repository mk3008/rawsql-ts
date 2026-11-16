import { describe, expect, test } from 'vitest';
import { SimpleSelectQuery } from '../src/models/SimpleSelectQuery';
import { LiteralValue } from '../src/models/ValueComponent';
import { InsertQueryParser } from '../src/parsers/InsertQueryParser';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('SQL string literal escaping', () => {
    const formatter = new SqlFormatter();

    test('preserves escaped apostrophes across repeated SELECT formatting', () => {
        const input = "SELECT * FROM users WHERE last_name = 'O''Brien'";
        const expected = `select * from "users" where "last_name" = 'O''Brien'`;
        const firstPass = formatter.format(SelectQueryParser.parse(input)).formattedSql;
        const secondPass = formatter.format(SelectQueryParser.parse(firstPass)).formattedSql;

        expect(firstPass).toBe(expected);
        expect(secondPass).toBe(expected);
    });

    test('preserves escaped apostrophes in INSERT values', () => {
        const query = InsertQueryParser.parse("INSERT INTO users (last_name) VALUES ('don''t')");

        expect(formatter.format(query).formattedSql).toBe(`insert into "users"("last_name") values ('don''t')`);
    });

    test.each([
        { literal: "'it''s'", value: "it''s" },
        { literal: "'a''''b''c'", value: "a''''b''c" },
        { literal: "''''", value: "''" },
        { literal: "''", value: '' },
        { literal: String.raw`'it\'s'`, value: String.raw`it\'s` },
    ])('preserves the source spelling of $literal in the AST and output', ({ literal, value }) => {
        const query = SelectQueryParser.parse(`SELECT ${literal} AS v`) as SimpleSelectQuery;
        const expression = query.selectClause.items[0].value;

        expect(expression).toBeInstanceOf(LiteralValue);
        expect((expression as LiteralValue).value).toBe(value);
        expect(formatter.format(query).formattedSql).toBe(`select ${literal} as "v"`);
    });

    test('escapes apostrophes when generating a string literal from a value', () => {
        const literal = new LiteralValue("O''Brien", undefined, true);

        expect(formatter.format(literal).formattedSql).toBe("'O''''Brien'");
    });

    test('escapes the new value when a parsed string literal is edited', () => {
        const query = SelectQueryParser.parse("SELECT 'O''Brien' AS v") as SimpleSelectQuery;
        const expression = query.selectClause.items[0].value as LiteralValue;
        expression.value = "O'Neill";

        expect(formatter.format(query).formattedSql).toBe(`select 'O''Neill' as "v"`);
    });

    test('preserves apostrophe pairs inside dollar-quoted strings', () => {
        const literal = "$$it''s$$";
        const query = SelectQueryParser.parse(`SELECT ${literal} AS v`) as SimpleSelectQuery;
        const expression = query.selectClause.items[0].value;

        expect(expression).toBeInstanceOf(LiteralValue);
        expect((expression as LiteralValue).value).toBe(literal);
        expect(formatter.format(query).formattedSql).toBe(`select ${literal} as "v"`);
    });
});
