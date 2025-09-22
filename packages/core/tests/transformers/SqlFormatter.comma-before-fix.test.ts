import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter - Comma Before Style Fix', () => {
    test('should avoid comma-only lines when using comma before style', () => {
        // Arrange
        const sql = `
            SELECT
                s.sale_id /* Sale ID */,
                s.amount
            FROM sales s
        `;

        const query = SelectQueryParser.parse(sql).toSimpleQuery();

        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n',
            commaBreak: 'before',
            indentChar: '  ',
            indentSize: 2
        });

        // Act
        const result = formatter.format(query);

        // Assert - with 'before' style, comma should be on the next line, not same line
        expect(result.formattedSql).toContain('"s"."sale_id" /* Sale ID */\n    , "s"."amount"');
        expect(result.formattedSql).not.toContain(',\n    "s"."amount"'); // Should not have comma on separate line
    });

    test('should handle multiple fields with comments correctly', () => {
        // Arrange
        const sql = `SELECT s.sale_id /* Sale ID */, p.product_name, s.amount /* Sale amount */, s.discount FROM sales s JOIN products p ON s.product_id = p.id`;

        const query = SelectQueryParser.parse(sql).toSimpleQuery();

        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n',
            commaBreak: 'before',
            indentChar: '    ',
            indentSize: 1
        });

        // Act
        const result = formatter.format(query);

        // Assert - all commas should be positioned correctly
        const lines = result.formattedSql.split('\n');
        const selectLines = lines.slice(1, 5); // SELECT clause lines

        // Each field line should either start with field name or have comma after field
        selectLines.forEach(line => {
            if (line.trim().startsWith(',')) {
                // If line starts with comma, it should have content after the comma
                expect(line.trim()).toMatch(/^,\s+\S/);
            }
        });

        // Specific checks - with 'before' style, commas should be on next lines
        expect(result.formattedSql).toContain('"s"."sale_id" /* Sale ID */\n    , "p"."product_name"');
        expect(result.formattedSql).toContain('"s"."amount" /* Sale amount */\n    , "s"."discount"');
    });

    test('should work correctly with comma after style (no regression)', () => {
        // Arrange
        const sql = `SELECT s.sale_id /* Sale ID */, s.amount FROM sales s`;

        const query = SelectQueryParser.parse(sql).toSimpleQuery();

        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n',
            commaBreak: 'after',
            indentChar: '  ',
            indentSize: 2
        });

        // Act
        const result = formatter.format(query);

        // Assert - comma after style should have comma at end of line with newline
        expect(result.formattedSql).toContain('"s"."sale_id" /* Sale ID */,\n    "s"."amount"');
    });

    test('should work correctly with no comma break style (no regression)', () => {
        // Arrange
        const sql = `SELECT s.sale_id /* Sale ID */, s.amount FROM sales s`;

        const query = SelectQueryParser.parse(sql).toSimpleQuery();

        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n',
            commaBreak: 'none',
            indentChar: '  ',
            indentSize: 2
        });

        // Act
        const result = formatter.format(query);

        // Assert - no comma break should keep comma on same line (no moving needed)
        expect(result.formattedSql).toContain('"s"."sale_id" /* Sale ID */, "s"."amount"');
    });
});