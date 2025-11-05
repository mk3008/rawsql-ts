import { describe, it, expect } from 'vitest';
import { AlterTableParser } from '../../src/parsers/AlterTableParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter ALTER TABLE spacing', () => {
    it('keeps the table name on the same line as ALTER TABLE', () => {
        const sql = [
            'ALTER TABLE',
            '    public.child_table ADD CONSTRAINT child_table_pkey PRIMARY KEY (child_id)',
            '    , ADD CONSTRAINT child_table_child_name_key UNIQUE (child_name)',
            '    , ADD CONSTRAINT child_table_value_check CHECK (value >= 0)',
        ].join('\n');

        const ast = AlterTableParser.parse(sql);
        const formatter = new SqlFormatter({
            indentChar: ' ',
            indentSize: 4,
            newline: '\n',
            keywordCase: 'lower',
            commaBreak: 'before',
            identifierEscape: 'none',
        });

        const { formattedSql } = formatter.format(ast);

        const expected = [
            'alter table public.child_table',
            '    add constraint child_table_pkey primary key(child_id)',
            '    , add constraint child_table_child_name_key unique(child_name)',
            '    , add constraint child_table_value_check check(value >= 0)',
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });
});
