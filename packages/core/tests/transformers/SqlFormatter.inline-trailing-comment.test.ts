import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter inline trailing comment regression', () => {
    it('preserves comments placed after closing parentheses in expressions', () => {
        const sql = 'select * from a where a.id in (1) --c';
        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            exportComment: true,
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'lower',
            identifierEscape: 'none',
            commaBreak: 'before',
        });

        const result = formatter.format(parsed).formattedSql;

        const expected = [
            'select',
            '    *',
            'from',
            '    a',
            'where',
            '    a.id in (1) /* c */',
        ].join('\n');

        expect(result).toBe(expected);
    });

    it('keeps comments for select items that are parenthesized expressions', () => {
        const sql = [
            'select',
            '1 --c1',
            ', (1) --c2',
            ', 1 in (1) --c3',
        ].join('\n');
        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            exportComment: true,
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'lower',
            identifierEscape: 'none',
            commaBreak: 'before',
        });

        const result = formatter.format(parsed).formattedSql;

        const expected = [
            'select',
            '    1 /* c1 */',
            '    , (1) /* c2 */',
            '    , 1 in (1) /* c3 */',
        ].join('\n');

        expect(result).toBe(expected);
    });
});
