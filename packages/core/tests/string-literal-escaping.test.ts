import { describe, expect, test } from 'vitest';
import { SimpleSelectQuery } from '../src/models/SimpleSelectQuery';
import { ValuesQuery } from '../src/models/ValuesQuery';
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

    test('preserves escaped apostrophes when formatted INSERT values are parsed again', () => {
        const query = InsertQueryParser.parse("INSERT INTO users (last_name) VALUES ('don''t')");
        const formattedSql = formatter.format(query).formattedSql;
        const values = InsertQueryParser.parse(formattedSql).selectQuery;

        expect(formattedSql).toBe(`insert into "users"("last_name") values ('don''t')`);
        expect(values).toBeInstanceOf(ValuesQuery);
        const literal = (values as ValuesQuery).tuples[0].values[0];
        expect(literal).toBeInstanceOf(LiteralValue);
        expect(literal).toMatchObject({ value: "don''t", isStringLiteral: true, isEscaped: true });
    });

    test.each([
        { literal: "'it''s'", value: "it''s" },
        { literal: "'a''''b''c'", value: "a''''b''c" },
        { literal: "''''", value: "''" },
        { literal: "''", value: '' },
        { literal: "' O''Brien  Jr. '", value: " O''Brien  Jr. " },
        { literal: String.raw`'it\'s'`, value: String.raw`it\'s` },
    ])('preserves the AST literal $literal across parse, format, and parse', ({ literal, value }) => {
        const query = SelectQueryParser.parse(`SELECT ${literal} AS v`) as SimpleSelectQuery;
        const formattedSql = formatter.format(query).formattedSql;
        const reparsed = SelectQueryParser.parse(formattedSql) as SimpleSelectQuery;
        const expected = { value, isStringLiteral: true, isEscaped: true };

        const before = query.selectClause.items[0].value;
        const after = reparsed.selectClause.items[0].value;
        expect(before).toBeInstanceOf(LiteralValue);
        expect(before).toMatchObject(expected);
        expect(after).toBeInstanceOf(LiteralValue);
        expect(after).toMatchObject(expected);
    });

    test.each([
        { isEscaped: false, expected: "'O''''Brien'" },
        { isEscaped: true, expected: "'O''Brien'" },
    ])('formats a new quoted value with isEscaped=$isEscaped', ({ isEscaped, expected }) => {
        const literal = new LiteralValue("O''Brien", undefined, true, { isEscaped });

        expect(formatter.format(literal).formattedSql).toBe(expected);
    });

    test('requires the escape state when constructing a quoted value', () => {
        expect(() => Reflect.construct(LiteralValue, ["O'Neill", undefined, true]))
            .toThrow(TypeError);
    });

    test('uses the supplied escape state when editing a quoted value', () => {
        const query = SelectQueryParser.parse("SELECT 'O''Brien' AS v") as SimpleSelectQuery;
        const expression = query.selectClause.items[0].value as LiteralValue;

        expression.setStringValue("O''Brien", { isEscaped: false });
        expect(formatter.format(query).formattedSql).toBe(`select 'O''''Brien' as "v"`);

        expression.setStringValue("O''Neill", { isEscaped: true });
        expect(formatter.format(query).formattedSql).toBe(`select 'O''Neill' as "v"`);

        expression.setStringValue("O'Neill", { isEscaped: false });
        expect(formatter.format(query).formattedSql).toBe(`select 'O''Neill' as "v"`);
    });

    test('rejects edits of a quoted value without an explicit escape state', () => {
        const query = SelectQueryParser.parse("SELECT 'O''Brien' AS v") as SimpleSelectQuery;
        const expression = query.selectClause.items[0].value as LiteralValue;

        expect(() => { expression.value = "O'Neill"; }).toThrow("Use setStringValue");
        expect(() => Reflect.apply(expression.setStringValue, expression, ["O'Neill"]))
            .toThrow(TypeError);
        expect(formatter.format(query).formattedSql).toBe(`select 'O''Brien' as "v"`);
    });

    test('keeps direct assignment available for numeric values', () => {
        const literal = new LiteralValue(1);
        literal.value = 2;

        expect(formatter.format(literal).formattedSql).toBe("2");
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
