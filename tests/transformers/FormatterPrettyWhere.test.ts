import { describe, test, expect } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { FormatterConfig } from '../../src/transformers/FormatterConfig';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('Formatter (pretty print) - where clause', () => {
    test('where clause with pretty indent', () => {
        const query = SelectQueryParser.parse('select * from users where id = 1 and name = \'mio\' and age > 10');
        const config: FormatterConfig = {
            oneLiner: false,
            clauseIndent: { select: false, from: false, where: true },
            indentType: 'space',
            indentSize: 4,
        };
        const formatter = new Formatter({}, config);
        const sql = formatter.format(query);
        expect(sql).toBe(
            `select *
from "users"
where
    "id" = 1
    and "name" = 'mio'
    and "age" > 10`
        );
    });

    test('where clause with one-liner', () => {
        const query = SelectQueryParser.parse('select * from users where id = 1 and name = \'mio\' and age > 10');
        const formatter2 = new Formatter();
        const sql2 = formatter2.format(query);
        expect(sql2).toBe('select * from "users" where "id" = 1 and "name" = \'mio\' and "age" > 10');
    });

    test('where clause with between and andnewline (pretty indent)', () => {
        // This test checks that the 'and' inside BETWEEN is not treated as a newline split point.
        const query = SelectQueryParser.parse("select * from users where price between 10 and 100 and name = 'mio'");
        const config: FormatterConfig = {
            oneLiner: false,
            clauseIndent: { select: false, from: false, where: true },
            indentType: 'space',
            indentSize: 4,
        };
        const formatter3 = new Formatter({}, config);
        const sql3 = formatter3.format(query);
        expect(sql3).toBe(
            `select *
from "users"
where
    "price" between 10 and 100
    and "name" = 'mio'`
        );
    });

    test('where clause with between and andnewline (one-liner)', () => {
        // This test checks that the 'and' inside BETWEEN is not treated as a newline split point in one-liner mode.
        const query = SelectQueryParser.parse("select * from users where price between 10 and 100 and name = 'mio'");
        const config: FormatterConfig = {
            oneLiner: true,
        };
        const formatter4 = new Formatter();
        const sql4 = formatter4.format(query);
        expect(sql4).toBe('select * from "users" where "price" between 10 and 100 and "name" = \'mio\'');
    });
});
