import { describe, test, expect } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { FormatterConfig } from '../../src/transformers/FormatterConfig';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

// This test is for pretty printing HAVING clause, similar to WHERE clause

describe('Formatter (pretty print) - having clause', () => {
    test('having clause with pretty indent', () => {
        const query = SelectQueryParser.parse('select department, count(*) from users group by department having count(*) > 5 and department != \'test\' and count(*) < 100');
        const config: FormatterConfig = {
            oneLiner: false,
            clauseIndent: { select: false, from: false, where: false, having: true },
            indentType: 'space',
            indentSize: 4,
        };
        const formatter = new Formatter({}, config);
        const sql = formatter.format(query);
        expect(sql).toBe(
            `select "department", count(*)\nfrom "users"\ngroup by "department"\nhaving\n    count(*) > 5\n    and "department" != 'test'\n    and count(*) < 100`
        );
    });

    test('having clause with one-liner', () => {
        const query = SelectQueryParser.parse('select department, count(*) from users group by department having count(*) > 5 and department != \'test\' and count(*) < 100');
        const formatter = new Formatter();
        const sql = formatter.format(query);
        expect(sql).toBe('select "department", count(*) from "users" group by "department" having count(*) > 5 and "department" != \'test\' and count(*) < 100');
    });

    test('having clause with between and andnewline (pretty indent)', () => {
        // This test checks that the 'and' inside BETWEEN is not treated as a newline split point.
        const query = SelectQueryParser.parse("select department, count(*) from users group by department having count(*) between 10 and 100 and department = 'test'");
        const config: FormatterConfig = {
            oneLiner: false,
            clauseIndent: { select: false, from: false, where: false, having: true },
            indentType: 'space',
            indentSize: 4,
        };
        const formatter3 = new Formatter({}, config);
        const sql3 = formatter3.format(query);
        expect(sql3).toBe(
            `select "department", count(*)\nfrom "users"\ngroup by "department"\nhaving\n    count(*) between 10 and 100\n    and "department" = 'test'`
        );
    });

    test('having clause with between and andnewline (one-liner)', () => {
        // This test checks that the 'and' inside BETWEEN is not treated as a newline split point in one-liner mode.
        const query = SelectQueryParser.parse("select department, count(*) from users group by department having count(*) between 10 and 100 and department = 'test'");
        const formatter4 = new Formatter({ identifierEscape: { start: '"', end: '"' }, parameterSymbol: ':' }, { oneLiner: true });
        const sql4 = formatter4.format(query);
        expect(sql4).toBe('select "department", count(*) from "users" group by "department" having count(*) between 10 and 100 and "department" = \'test\'');
    });
});
