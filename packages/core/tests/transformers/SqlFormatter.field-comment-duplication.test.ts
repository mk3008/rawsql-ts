import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter field comment duplication prevention', () => {
    const formatterOptions = {
        identifierEscape: {
            start: "\"",
            end: "\""
        },
        parameterSymbol: "$",
        parameterStyle: "indexed" as const,
        indentSize: 4,
        indentChar: " " as const,
        newline: "\n" as const,
        keywordCase: "upper" as const,
        commaBreak: "before" as const,
        andBreak: "before" as const,
        exportComment: true,
        parenthesesOneLine: true,
        betweenOneLine: true,
        valuesOneLine: true,
        joinOneLine: true,
        caseOneLine: true,
        subqueryOneLine: true
    };

    it('should not duplicate field calculation comments', () => {
        const sql = `
            SELECT
                s.quantity /* Quantity */,
                s.unit_price /* Unit price */,
                /* Net amount calculation */
                s.quantity * s.unit_price * (1 - s.discount_rate) AS net_amount
            FROM sales s
        `;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Should contain the comment only once
        const commentMatches = result.formattedSql.match(/\/\*\s*Net amount calculation\s*\*\//g);
        expect(commentMatches).toHaveLength(1);

        // Should not contain duplicate pattern
        expect(result.formattedSql).not.toMatch(/\/\*\s*Net amount calculation\s*\*\/\s*\/\*\s*Net amount calculation\s*\*\//);

        console.log('=== FORMATTED SQL ===');
        console.log(result.formattedSql);
        console.log('=== COMMENT COUNT ===');
        const netMatches = result.formattedSql.match(/\/\*\s*Net amount calculation\s*\*\//g);
        console.log('Net amount matches:', netMatches?.length || 0);
    });

    it('should not duplicate comments in complex expressions with comma break', () => {
        const sql = `
            SELECT
                field1,
                field2 /* Field 2 comment */,
                /* Expression comment */
                complex_expression(field3, field4) AS calculated_field
            FROM table1
        `;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Each comment should appear only once
        const field2Matches = result.formattedSql.match(/\/\*\s*Field 2 comment\s*\*\//g);
        const expressionMatches = result.formattedSql.match(/\/\*\s*Expression comment\s*\*\//g);

        expect(field2Matches).toHaveLength(1);
        expect(expressionMatches).toHaveLength(1);

        // Should not duplicate any comments
        expect(result.formattedSql).not.toMatch(/\/\*\s*Field 2 comment\s*\*\/\s*\/\*\s*Field 2 comment\s*\*\//);
        expect(result.formattedSql).not.toMatch(/\/\*\s*Expression comment\s*\*\/\s*\/\*\s*Expression comment\s*\*\//);

        console.log('=== FORMATTED SQL ===');
        console.log(result.formattedSql);
        console.log('=== COMMENT COUNT ===');
        const netMatches = result.formattedSql.match(/\/\*\s*Net amount calculation\s*\*\//g);
        console.log('Net amount matches:', netMatches?.length || 0);
    });

    it('should handle complex SELECT clause with multiple comment positions', () => {
        const sql = `
            SELECT
                s.sale_id /* Sale ID */,
                s.customer_id,
                s.quantity /* Quantity */,
                s.unit_price /* Unit price */,
                s.discount_rate /* Discount rate */,
                /* Net amount calculation */
                s.quantity * s.unit_price * (1 - s.discount_rate) AS net_amount
            FROM sales s
        `;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // All comments should appear exactly once
        const allComments = result.formattedSql.match(/\/\*[^*]*\*\//g) || [];
        const commentTexts = allComments.map(c => c.replace(/\/\*\s*|\s*\*\//g, ''));

        console.log('Found comments:', commentTexts);

        // Check for duplications
        const uniqueComments = new Set(commentTexts);
        expect(uniqueComments.size).toBe(commentTexts.length); // No duplicates

        // Specifically check the Net amount calculation comment
        const netAmountMatches = result.formattedSql.match(/\/\*\s*Net amount calculation\s*\*\//g);
        expect(netAmountMatches).toHaveLength(1);

        console.log('=== FORMATTED SQL ===');
        console.log(result.formattedSql);
        console.log('=== COMMENT COUNT ===');
        const netMatches = result.formattedSql.match(/\/\*\s*Net amount calculation\s*\*\//g);
        console.log('Net amount matches:', netMatches?.length || 0);
    });
});