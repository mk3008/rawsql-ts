import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter - oneLineMaxLength option', () => {
    test('keeps short SSSQL-style optional predicates on one line', () => {
        const formatter = new SqlFormatter({
            newline: 'lf',
            indentChar: 'space',
            indentSize: 4,
            keywordCase: 'lower',
            identifierEscape: 'none',
            parameterSymbol: ':',
            parameterStyle: 'named',
            parenthesesOneLine: true,
            orBreak: 'before',
            oneLineMaxLength: 120,
        });

        const query = SelectQueryParser.parse(`
            select *
            from tickets
            where (cast(:status as text) is null or status = :status)
        `);

        const { formattedSql } = formatter.format(query);

        expect(formattedSql).toContain('(cast(:status as text) is null or status = :status)');
    });

    test('expands long optional predicate groups when the one-line candidate is too wide', () => {
        const formatter = new SqlFormatter({
            newline: 'lf',
            indentChar: 'space',
            indentSize: 4,
            keywordCase: 'lower',
            identifierEscape: 'none',
            parameterSymbol: ':',
            parameterStyle: 'named',
            parenthesesOneLine: true,
            indentNestedParentheses: true,
            orBreak: 'before',
            oneLineMaxLength: 80,
        });

        const query = SelectQueryParser.parse(`
            select *
            from tickets
            where (:keyword is null
                or subject ilike '%' || :keyword || '%'
                or customer_name ilike '%' || :keyword || '%'
                or latest_message_body ilike '%' || :keyword || '%')
        `);

        const { formattedSql } = formatter.format(query);

        expect(formattedSql).toContain('(\n        :keyword is null');
        expect(formattedSql).toContain("\n        or subject ilike '%' || :keyword || '%'");
        expect(formattedSql).toContain("\n        or customer_name ilike '%' || :keyword || '%'");
        expect(formattedSql).toContain("\n        or latest_message_body ilike '%' || :keyword || '%'");
    });

    test('expands long CASE optional predicates while retaining readable CASE layout', () => {
        const formatter = new SqlFormatter({
            newline: 'lf',
            indentChar: 'space',
            indentSize: 4,
            keywordCase: 'lower',
            identifierEscape: 'none',
            parameterSymbol: ':',
            parameterStyle: 'named',
            parenthesesOneLine: true,
            caseOneLine: true,
            indentNestedParentheses: true,
            orBreak: 'before',
            oneLineMaxLength: 90,
        });

        const query = SelectQueryParser.parse(`
            select *
            from tickets t
            where (cast(:slaState as text) is null
                or case
                    when t.sla_due_at is null then 'none'
                    when t.sla_due_at < now() then 'breached'
                    when t.sla_due_at < now() + interval '4 hours' then 'warning'
                    else 'ok'
                end = :slaState)
        `);

        const { formattedSql } = formatter.format(query);

        expect(formattedSql).toContain('(\n        cast(:slaState as text) is null');
        expect(formattedSql).toContain('\n        or case');
        expect(formattedSql).toContain("\n            when t.sla_due_at is null then");
        expect(formattedSql).toContain("\n            else");
    });

    test('falls back from cte-oneline when a CTE entry exceeds the limit', () => {
        const formatter = new SqlFormatter({
            newline: 'lf',
            indentChar: 'space',
            indentSize: 4,
            keywordCase: 'lower',
            identifierEscape: 'none',
            withClauseStyle: 'cte-oneline',
            commaBreak: 'after',
            cteCommaBreak: 'after',
            oneLineMaxLength: 60,
        });

        const query = SelectQueryParser.parse(`
            with long_filtered_tickets as (
                select ticket_id, subject, customer_name
                from tickets
                where subject is not null
            )
            select *
            from long_filtered_tickets
        `);

        const { formattedSql } = formatter.format(query);

        expect(formattedSql).toContain('long_filtered_tickets as (');
        expect(formattedSql).toContain('\n        select');
        expect(formattedSql).toContain('\n        from\n            tickets');
    });

    test('treats sub-unit fractional limits as unset instead of a zero-width guard', () => {
        const formatter = new SqlFormatter({
            newline: 'lf',
            indentChar: 'space',
            indentSize: 4,
            keywordCase: 'lower',
            identifierEscape: 'none',
            parameterSymbol: ':',
            parameterStyle: 'named',
            parenthesesOneLine: true,
            orBreak: 'before',
            oneLineMaxLength: 0.5,
        });

        const query = SelectQueryParser.parse(`
            select *
            from tickets
            where (cast(:status as text) is null or status = :status)
        `);

        const { formattedSql } = formatter.format(query);

        expect(formattedSql).toContain('(cast(:status as text) is null or status = :status)');
    });
});
