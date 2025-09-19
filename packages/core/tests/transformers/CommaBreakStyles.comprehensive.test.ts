import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('CommaBreakStyles - Comprehensive TDD Test', () => {
    const testSql = `SELECT s.sale_id /* Sale ID */, s.sale_date /* Sale date */, s.customer_id /* Customer ID */ FROM sales s`;

    test('RED: before comma style should have comma at start of next line', () => {
        // Arrange
        const query = SelectQueryParser.parse(testSql).toSimpleQuery();
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

        // Assert - before style: comma at start of next line
        expect(result.formattedSql).toContain('"s"."sale_id" /* Sale ID */\n    , "s"."sale_date"');
        expect(result.formattedSql).toContain('"s"."sale_date" /* Sale date */\n    , "s"."customer_id"');

        // Should NOT have comma on same line as field
        expect(result.formattedSql).not.toContain('/* Sale ID */,');
        expect(result.formattedSql).not.toContain('/* Sale date */,');
    });

    test('RED: after comma style should have comma at end of line with newline after', () => {
        // Arrange
        const query = SelectQueryParser.parse(testSql).toSimpleQuery();
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n',
            commaBreak: 'after',
            indentChar: '    ',
            indentSize: 1
        });

        // Act
        const result = formatter.format(query);

        console.log('=== AFTER COMMA RESULT ===');
        console.log(result.formattedSql);
        console.log('=== LINES ===');
        result.formattedSql.split('\n').forEach((line, i) => {
            console.log(`${i}: "${line}"`);
        });

        // Assert - after style: comma at end of line, then newline
        expect(result.formattedSql).toContain('"s"."sale_id" /* Sale ID */,\n    "s"."sale_date"');
        expect(result.formattedSql).toContain('"s"."sale_date" /* Sale date */,\n    "s"."customer_id"');

        // Should NOT have all fields on same line
        expect(result.formattedSql).not.toContain('/* Sale ID */,    "s"."sale_date"');
        expect(result.formattedSql).not.toContain('/* Sale date */,    "s"."customer_id"');
    });

    test('RED: none comma style should have fields on same line with comma', () => {
        // Arrange
        const query = SelectQueryParser.parse(testSql).toSimpleQuery();
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n',
            commaBreak: 'none',
            indentChar: '    ',
            indentSize: 1
        });

        // Act
        const result = formatter.format(query);

        // Assert - none style: comma with space, no line breaks between fields
        expect(result.formattedSql).toContain('"s"."sale_id" /* Sale ID */, "s"."sale_date"');
        expect(result.formattedSql).toContain('"s"."sale_date" /* Sale date */, "s"."customer_id"');

        // Should NOT have comma on separate lines
        expect(result.formattedSql).not.toContain('/* Sale ID */\n    ,');
        expect(result.formattedSql).not.toContain('/* Sale date */\n    ,');
    });
});