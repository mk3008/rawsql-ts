import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter - After Comma Regression Test', () => {
    test('should properly format after comma style with newlines between fields', () => {
        // Arrange
        const sql = `SELECT s.sale_id /* Sale ID */, s.sale_date /* Sale date */, s.customer_id /* Customer ID */ FROM sales s`;

        const query = SelectQueryParser.parse(sql).toSimpleQuery();

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

        // Assert - after style should have each field on separate line with comma at end
        const lines = result.formattedSql.split('\n');
        console.log('=== FORMATTED SQL ===');
        console.log(result.formattedSql);
        console.log('=== LINES ===');
        lines.forEach((line, i) => console.log(`${i}: "${line}"`));

        // Each field should be on its own line
        expect(result.formattedSql).toContain('"s"."sale_id" /* Sale ID */,\n');
        expect(result.formattedSql).toContain('"s"."sale_date" /* Sale date */,\n');
        expect(result.formattedSql).toContain('"s"."customer_id" /* Customer ID */\n');

        // Should NOT have multiple fields on same line
        expect(result.formattedSql).not.toContain('/* Sale ID */,            "s"."sale_date"');
        expect(result.formattedSql).not.toContain('/* Sale date */,            "s"."customer_id"');
    });
});