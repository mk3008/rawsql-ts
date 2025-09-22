import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter - CTE Name Comments', () => {
    describe('CTE name preceding comments', () => {
        it('should preserve preceding comments for CTE names', () => {
            // Arrange
            const sql = `
                WITH /* Raw data preparation */ raw_sales AS (
                    SELECT sale_id, quantity FROM sales
                ),
                /* Customer data */ customer_data AS (
                    SELECT customer_id, name FROM customers
                )
                SELECT * FROM raw_sales rs JOIN customer_data cd ON rs.customer_id = cd.customer_id
            `;

            // Act
            const query = SelectQueryParser.parse(sql);
            const formatter = new SqlFormatter({
                identifierEscape: { start: '"', end: '"' },
                exportComment: true,
                keywordCase: 'lower',
                indentSize: 2,
                indentChar: ' '
            });
            const result = formatter.format(query);

            console.log('\n=== Original SQL ===');
            console.log(sql);

            console.log('\n=== Formatted SQL ===');
            console.log(result.formattedSql);

            // Assert
            expect(result.formattedSql).toContain('/* Raw data preparation */');
            expect(result.formattedSql).toContain('/* Customer data */');
            expect(result.formattedSql).toContain('"raw_sales"');
            expect(result.formattedSql).toContain('"customer_data"');
        });

        it('should preserve preceding comments immediately before CTE names', () => {
            // Arrange - Single CTE with comment directly before name
            const sql = `WITH /* Sales summary */ sales_data AS (SELECT * FROM sales) SELECT * FROM sales_data`;

            // Act
            const query = SelectQueryParser.parse(sql);
            const formatter = new SqlFormatter({
                identifierEscape: { start: '"', end: '"' },
                exportComment: true,
                keywordCase: 'upper'
            });
            const result = formatter.format(query);

            console.log('\n=== Original SQL ===');
            console.log(sql);

            console.log('\n=== Formatted SQL ===');
            console.log(result.formattedSql);

            // Assert
            expect(result.formattedSql).toContain('/* Sales summary */');
            expect(result.formattedSql).toContain('"sales_data"');
        });

        it('should handle multiple comments before CTE names', () => {
            // Arrange
            const sql = `
                WITH
                /* First comment */
                /* Second comment */
                data_prep AS (
                    SELECT id FROM table1
                )
                SELECT * FROM data_prep
            `;

            // Act
            const query = SelectQueryParser.parse(sql);
            const formatter = new SqlFormatter({
                identifierEscape: { start: '"', end: '"' },
                exportComment: true,
                keywordCase: 'lower'
            });
            const result = formatter.format(query);

            console.log('\n=== Original SQL ===');
            console.log(sql);

            console.log('\n=== Formatted SQL ===');
            console.log(result.formattedSql);

            // Assert
            expect(result.formattedSql).toContain('/* First comment */');
            expect(result.formattedSql).toContain('/* Second comment */');
            expect(result.formattedSql).toContain('"data_prep"');
        });
    });

    describe('CTE name following comments', () => {
        it('should preserve following comments for CTE names', () => {
            // Arrange
            const sql = `
                WITH raw_sales /* Sales table */ AS (
                    SELECT sale_id, quantity FROM sales
                )
                SELECT * FROM raw_sales
            `;

            // Act
            const query = SelectQueryParser.parse(sql);
            const formatter = new SqlFormatter({
                identifierEscape: { start: '"', end: '"' },
                exportComment: true,
                keywordCase: 'lower'
            });
            const result = formatter.format(query);

            console.log('\n=== Original SQL ===');
            console.log(sql);

            console.log('\n=== Formatted SQL ===');
            console.log(result.formattedSql);

            // Assert
            expect(result.formattedSql).toContain('/* Sales table */');
            expect(result.formattedSql).toContain('"raw_sales"');
        });
    });

    describe('Mixed CTE name comment positions', () => {
        it('should handle both preceding and following comments on CTE names', () => {
            // Arrange
            const sql = `
                WITH
                /* Preceding comment */ raw_sales /* Following comment */ AS (
                    SELECT sale_id FROM sales
                ),
                /* Another CTE */ customer_data AS (
                    SELECT customer_id FROM customers
                )
                SELECT * FROM raw_sales JOIN customer_data USING(customer_id)
            `;

            // Act
            const query = SelectQueryParser.parse(sql);
            const formatter = new SqlFormatter({
                identifierEscape: { start: '"', end: '"' },
                exportComment: true,
                keywordCase: 'upper'
            });
            const result = formatter.format(query);

            console.log('\n=== Original SQL ===');
            console.log(sql);

            console.log('\n=== Formatted SQL ===');
            console.log(result.formattedSql);

            // Assert
            expect(result.formattedSql).toContain('/* Preceding comment */');
            expect(result.formattedSql).toContain('/* Following comment */');
            expect(result.formattedSql).toContain('/* Another CTE */');
            expect(result.formattedSql).toContain('"raw_sales"');
            expect(result.formattedSql).toContain('"customer_data"');
        });
    });
});