import { describe, it, expect } from 'vitest';
import { ValuesQueryParser } from '../../src/parsers/ValuesQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter VALUES comment indentation', () => {
    it('aligns comment indentation with tuple content when using after-style comma break', () => {
        // Arrange: build VALUES clause with inline comments inside the tuple.
        const sql = [
            'values (',
            '    -- a',
            '    1001,',
            '    -- b',
            "    'test'",
            ')',
        ].join('\n');

        // Act: format using options that mimic the reported configuration.
        const formatter = new SqlFormatter({
            identifierEscape: 'none',
            parameterSymbol: ':',
            parameterStyle: 'named',
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'lower',
            commaBreak: 'before',
            valuesCommaBreak: 'after',
            andBreak: 'before',
            orBreak: 'before',
            exportComment: true,
            commentStyle: 'smart',
            withClauseStyle: 'standard',
            parenthesesOneLine: true,
            indentNestedParentheses: true,
            betweenOneLine: true,
            valuesOneLine: false,
            joinOneLine: true,
            caseOneLine: false,
            subqueryOneLine: false,
            insertColumnsOneLine: true,
        });

        const clause = ValuesQueryParser.parse(sql);
        const result = formatter.format(clause);

        // Assert: ensure comments stay aligned with the tuple values.
        const expected = [
            'values',
            '    (',
            '        -- a',
            '        1001,',
            '        -- b',
            "        'test'",
            '    )',
        ].join('\n');

        expect(result.formattedSql).toBe(expected);
    });
});
