import { describe, it, expect } from 'vitest';
import { InsertQueryParser } from '../src/parsers/InsertQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('SqlFormatter insert formatting', () => {
    it('formats column lists with before-style commas and multiline values', () => {
        const sql = [
            'insert into table_a (',
            '    id',
            '    , value',
            ')',
            'values',
            '    (1, 10)',
            '    , (2, 20)',
        ].join('\n');

        const insert = InsertQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'lower',
            commaBreak: 'before',
            valuesCommaBreak: 'before',
            identifierEscape: 'none',
        });

        const { formattedSql } = formatter.format(insert);

        const expected = [
            'insert into table_a(',
            '    id',
            '    , value',
            ')',
            'values',
            '    (1, 10)',
            '    , (2, 20)',
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });

    it('preserves line comments in VALUES rows when exportComment is enabled', () => {
        const sql = [
            'insert into table_a(',
            '    id',
            '    , value',
            ')',
            'values',
            '    (1, 10) -- first row',
            '    , (2, 20) -- second row',
        ].join('\n');

        const insert = InsertQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'lower',
            commaBreak: 'before',
            valuesCommaBreak: 'before',
            identifierEscape: 'none',
            exportComment: true,
        });

        const { formattedSql } = formatter.format(insert);

        const firstRowLines = formattedSql.split('\n').filter(line => line.includes('/* first row */'));
        const secondRowLines = formattedSql.split('\n').filter(line => line.includes('/* second row */'));

        expect(firstRowLines).toHaveLength(2);
        expect(secondRowLines).toHaveLength(2);
        expect(formattedSql).toContain('(1, 10) /* first row */');
        expect(formattedSql).toContain(', (2, 20) /* second row */');
        expect(firstRowLines.some(line => line.trim() === '/* first row */')).toBe(true);
        expect(secondRowLines.some(line => line.trim() === '/* second row */')).toBe(true);
    });

    it('supports single-line column lists when configured', () => {
        const sql = [
            'insert into table_a (',
            '    id',
            '    , value',
            ')',
            'values',
            '    (1, 10)',
            '    , (2, 20)',
        ].join('\n');

        const insert = InsertQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'lower',
            commaBreak: 'before',
            valuesCommaBreak: 'before',
            identifierEscape: 'none',
            insertColumnsOneLine: true,
        });

        const { formattedSql } = formatter.format(insert);

        const expected = [
            'insert into table_a(id, value)',
            'values',
            '    (1, 10)',
            '    , (2, 20)',
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });
});
