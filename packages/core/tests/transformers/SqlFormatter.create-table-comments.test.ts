import { describe, it, expect } from 'vitest';
import { CreateTableParser } from '../../src/parsers/CreateTableParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter CREATE TABLE comment preservation', () => {
    it('retains comments surrounding column definitions when formatting', () => {
        const sql = [
            '-- c1',
            'create table users (',
            '    -- c2',
            '    user_id serial primary key',
            '    -- c3',
            '    ,',
            '    -- c4',
            '    username varchar(50) not null',
            '    -- c5',
            ')',
            ';',
        ].join('\n');

        const parsed = CreateTableParser.parse(sql);
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'lower',
            newline: '\n',
            indentSize: 4,
            indentChar: ' ',
            commaBreak: 'before',
            identifierEscape: 'none',
        });

        const { formattedSql } = formatter.format(parsed);

        expect(formattedSql).toContain('c1');
        expect(formattedSql).toContain('c2');
        expect(formattedSql).toContain('c3');
        expect(formattedSql).toContain('c4');
        expect(formattedSql).toContain('c5');
    });

    it('preserves inline comments after multi-word data types', () => {
        const sql = [
            'create table users (',
            '    deleted_at timestamp with time zone --c2',
            ')'
        ].join('\n');

        const parsed = CreateTableParser.parse(sql);
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'lower',
            newline: '\n',
            indentSize: 4,
            indentChar: ' ',
            commaBreak: 'before',
            identifierEscape: 'none'
        });

        const { formattedSql } = formatter.format(parsed);

        expect(formattedSql).toContain('/* c2 */');
    });
});
