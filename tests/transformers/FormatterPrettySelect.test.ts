import { describe, test, expect } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { FormatterConfig } from '../../src/transformers/FormatterConfig';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

// Test for select clause pretty formatting

describe('Formatter (pretty print) - Select', () => {
    test('select clause with pretty indent', () => {
        const query = SelectQueryParser.parse('select u.user_id, u.value, u.name from users as u') as SimpleSelectQuery
        const config: FormatterConfig = {
            oneLiner: false,
            clauseIndent: { select: true },
            indentType: 'space',
            indentSize: 4,
            commaPosition: 'before',
        };
        const formatter = new Formatter({}, config);
        const sql = formatter.format(query.selectClause);
        // Comma position: before, indent: 4 spaces
        expect(sql).toBe(`select
    "u"."user_id"
    , "u"."value"
    , "u"."name"`);
    });

    test('select clause with one-liner', () => {
        const query = SelectQueryParser.parse('select u.user_id, u.value, u.name from users as u') as SimpleSelectQuery
        const config: FormatterConfig = {
            oneLiner: true,
        };
        const formatter2 = new Formatter({}, config);
        const sql2 = formatter2.format(query.selectClause);
        expect(sql2).toBe('select "u"."user_id", "u"."value", "u"."name"');
    });

    test('select clause with after comma', () => {
        const query = SelectQueryParser.parse('select u.user_id, u.value, u.name from users as u') as SimpleSelectQuery
        const config: FormatterConfig = {
            oneLiner: false,
            clauseIndent: { select: true },
            commaPosition: 'after',
            indentType: 'space',
            indentSize: 4,
        };
        const formatter3 = new Formatter({}, config);
        const sql3 = formatter3.format(query.selectClause);
        expect(sql3).toBe(
            `select
    "u"."user_id",
    "u"."value",
    "u"."name"`
        );
    });
});
