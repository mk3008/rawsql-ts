import { describe, it, expect } from 'vitest';
import { SqlParser } from '../../src/parsers/SqlParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { ExplainStatement } from '../../src/models/DDLStatements';

describe('SqlFormatter.explain', () => {
    it('formats EXPLAIN with legacy flags', () => {
        const parsed = SqlParser.parse('EXPLAIN ANALYZE VERBOSE SELECT id FROM users');
        expect(parsed).toBeInstanceOf(ExplainStatement);
        if (!(parsed instanceof ExplainStatement)) {
            throw new Error('Expected SqlParser.parse to return ExplainStatement for EXPLAIN input');
        }
        const formatter = new SqlFormatter();

        const { formattedSql } = formatter.format(parsed);

        expect(formattedSql).toBe('explain analyze verbose select "id" from "users"');
    });

    it('formats EXPLAIN option list with explicit values', () => {
        const parsed = SqlParser.parse('EXPLAIN (ANALYZE false, FORMAT JSON) SELECT id FROM users');
        expect(parsed).toBeInstanceOf(ExplainStatement);
        if (!(parsed instanceof ExplainStatement)) {
            throw new Error('Expected SqlParser.parse to return ExplainStatement for EXPLAIN input');
        }
        const formatter = new SqlFormatter();

        const { formattedSql } = formatter.format(parsed);

        expect(formattedSql).toBe('explain(analyze false, format "JSON") select "id" from "users"');
    });

    it('keeps EXPLAIN targets left-aligned when multiline formatting is enabled', () => {
        const parsed = SqlParser.parse('EXPLAIN ANALYZE SELECT id FROM users');
        expect(parsed).toBeInstanceOf(ExplainStatement);
        if (!(parsed instanceof ExplainStatement)) {
            throw new Error('Expected SqlParser.parse to return ExplainStatement for EXPLAIN input');
        }
        const formatter = new SqlFormatter({
            newline: '\n',
            indentChar: '    ',
            indentSize: 1,
        });

        const { formattedSql } = formatter.format(parsed);

        expect(formattedSql).toBe(
            [
                'explain analyze',
                'select',
                '    "id"',
                'from',
                '    "users"',
            ].join('\n'),
        );
    });
});
