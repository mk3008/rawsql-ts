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
        // Each field should be on its own line with trailing comma for after style
        expect(result.formattedSql).toContain('"s"."sale_id" /* Sale ID */,');
        expect(result.formattedSql).toContain('"s"."sale_date" /* Sale date */,');
        expect(result.formattedSql).toMatch(/"s"\."customer_id" \/\* Customer ID \*\/\nFROM/);

        // Ensure comma does not remain attached to the following expression
        expect(result.formattedSql).not.toContain('/* Sale ID */, "s"."sale_date"');
        expect(result.formattedSql).not.toContain('/* Sale date */, "s"."customer_id"');
    });
});
