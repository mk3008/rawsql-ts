import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const sql = `
    select *
    from searchable_tickets st
    left join last_customer_reply lcr on lcr.ticket_id = st.ticket_id
        and lcr.tenant_id = st.tenant_id
        and lcr.source_id = st.source_id
`;

const baseOptions = {
    newline: 'lf',
    indentChar: 'space',
    indentSize: 4,
    keywordCase: 'lower',
    identifierEscape: 'none',
    sourceAliasStyle: 'omit',
    andBreak: 'before',
} as const;

describe('SqlFormatter - JOIN condition layout options', () => {
    test('keeps existing JOIN condition indentation by default', () => {
        const formatter = new SqlFormatter(baseOptions);
        const { formattedSql } = formatter.format(SelectQueryParser.parse(sql));

        expect(formattedSql).toContain(
            [
                '    left join last_customer_reply lcr on lcr.ticket_id = st.ticket_id',
                '    and lcr.tenant_id = st.tenant_id',
                '    and lcr.source_id = st.source_id',
            ].join('\n'),
        );
    });

    test('treats legacy joinOnBreak after as none', () => {
        const formatter = new SqlFormatter({
            ...baseOptions,
            joinOnBreak: 'after',
        });
        const { formattedSql } = formatter.format(SelectQueryParser.parse(sql));

        expect(formattedSql).toContain(
            [
                '    left join last_customer_reply lcr on lcr.ticket_id = st.ticket_id',
                '    and lcr.tenant_id = st.tenant_id',
                '    and lcr.source_id = st.source_id',
            ].join('\n'),
        );
    });

    test('treats legacy keywordCase preserve as none', () => {
        const formatter = new SqlFormatter({
            ...baseOptions,
            keywordCase: 'preserve',
        });
        const { formattedSql } = formatter.format(SelectQueryParser.parse(sql));

        expect(formattedSql).toContain('select');
        expect(formattedSql).not.toContain('SELECT');
        expect(formattedSql).toContain('left join last_customer_reply lcr on');
    });

    test('breaks before ON and indents the JOIN condition when joinOnBreak is before', () => {
        const formatter = new SqlFormatter({
            ...baseOptions,
            joinOnBreak: 'before',
        });
        const { formattedSql } = formatter.format(SelectQueryParser.parse(sql));

        expect(formattedSql).toContain(
            [
                '    left join last_customer_reply lcr',
                '        on lcr.ticket_id = st.ticket_id',
                '        and lcr.tenant_id = st.tenant_id',
                '        and lcr.source_id = st.source_id',
            ].join('\n'),
        );
    });

    test('keeps ON inline while indenting continuation predicates', () => {
        const formatter = new SqlFormatter({
            ...baseOptions,
            joinConditionContinuationIndent: true,
        });
        const { formattedSql } = formatter.format(SelectQueryParser.parse(sql));

        expect(formattedSql).toContain(
            [
                '    left join last_customer_reply lcr on lcr.ticket_id = st.ticket_id',
                '        and lcr.tenant_id = st.tenant_id',
                '        and lcr.source_id = st.source_id',
            ].join('\n'),
        );
    });

    test('composes ON break with continuation indentation without double indenting', () => {
        const formatter = new SqlFormatter({
            ...baseOptions,
            joinOnBreak: 'before',
            joinConditionContinuationIndent: true,
        });
        const { formattedSql } = formatter.format(SelectQueryParser.parse(sql));

        expect(formattedSql).toContain(
            [
                '    left join last_customer_reply lcr',
                '        on lcr.ticket_id = st.ticket_id',
                '        and lcr.tenant_id = st.tenant_id',
                '        and lcr.source_id = st.source_id',
            ].join('\n'),
        );
    });

    test('indents OR continuation predicates inside JOIN ON conditions', () => {
        const formatter = new SqlFormatter({
            ...baseOptions,
            orBreak: 'before',
            joinConditionContinuationIndent: true,
        });
        const { formattedSql } = formatter.format(SelectQueryParser.parse(`
            select *
            from searchable_tickets st
            left join last_customer_reply lcr on lcr.ticket_id = st.ticket_id
                or lcr.parent_ticket_id = st.ticket_id
        `));

        expect(formattedSql).toContain(
            [
                '    left join last_customer_reply lcr on lcr.ticket_id = st.ticket_id',
                '        or lcr.parent_ticket_id = st.ticket_id',
            ].join('\n'),
        );
    });
});
