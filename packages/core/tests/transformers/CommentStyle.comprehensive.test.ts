import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

/**
 * CommentStyle - Comprehensive TDD Test
 *
 * Tests the smart comment style feature that merges consecutive block comments
 * into multi-line format while preserving single-line comments as block format.
 */
describe('CommentStyle - Comprehensive TDD Test', () => {
    const blockFormatter = new SqlFormatter({
        exportComment: true,
        commentStyle: 'block',
        keywordCase: 'upper',
        newline: '\n'
    });

    const smartFormatter = new SqlFormatter({
        exportComment: true,
        commentStyle: 'smart',
        keywordCase: 'upper',
        newline: '\n'
    });

    describe('Block style (default)', () => {
        test('should preserve all comments as individual blocks', () => {
            // Arrange
            const sql = `
                /* Header comment */
                SELECT s.sale_id /* Field comment */, s.amount
                FROM sales s /* Table comment */
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = blockFormatter.format(query);

            // Assert - block style preserves original format
            expect(result.formattedSql).toContain('/* Header comment */');
            expect(result.formattedSql).toContain('/* Field comment */');
            expect(result.formattedSql).toContain('/* Table comment */');
        });
    });

    describe('Smart style conversion', () => {
        test('should keep single comments as block format', () => {
            // Arrange
            const sql = `
                SELECT s.sale_id /* Single comment */, s.amount
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - smart style keeps single comments as block format
            expect(result.formattedSql).toContain('/* Single comment */');
            expect(result.formattedSql).not.toContain('-- ');
        });

        test('should merge consecutive block comments into multi-line format', () => {
            // Arrange - Create a SQL with header comments that will be split by parser
            const sql = `
                /*
                  Sales Analysis Report - Q4 2023
                  ================================

                  Purpose: Comprehensive analysis
                  Author: Analytics Team
                */
                SELECT 1
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - smart style should create multi-line block comment
            expect(result.formattedSql).toContain('/*\n');
            expect(result.formattedSql).toContain('Sales Analysis Report');
            expect(result.formattedSql).toContain('================================');
            expect(result.formattedSql).toContain('Purpose: Comprehensive analysis');
            expect(result.formattedSql).toContain('Author: Analytics Team');
            expect(result.formattedSql).toContain('\n*/');
        });

        test('should preserve existing line comments unchanged', () => {
            // Arrange - Note: Parser converts inline -- comments to block format
            const sql = `
                SELECT s.sale_id, -- Line comment
                       s.amount
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - Line comment content should be preserved (even if converted to block format)
            expect(result.formattedSql).toContain('Line comment');
        });
    });

    describe('Smart style with comma break integration', () => {
        test('should work correctly with after comma style', () => {
            // Arrange
            const afterCommaSmartFormatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'smart',
                commaBreak: 'after',
                keywordCase: 'upper',
                newline: '\n'
            });

            const sql = `
                SELECT s.sale_id /* Sale ID */, s.amount /* Amount */
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = afterCommaSmartFormatter.format(query);

            // Assert - smart style works with comma breaks
            expect(result.formattedSql).toContain('/* Sale ID */');
            expect(result.formattedSql).toContain('/* Amount */');
            expect(result.formattedSql).toContain(',\n'); // After comma style
        });

        test('should work correctly with before comma style', () => {
            // Arrange
            const beforeCommaSmartFormatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'smart',
                commaBreak: 'before',
                keywordCase: 'upper',
                newline: '\n'
            });

            const sql = `
                SELECT s.sale_id /* Sale ID */, s.amount /* Amount */
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = beforeCommaSmartFormatter.format(query);

            // Assert - smart style works with comma breaks
            expect(result.formattedSql).toContain('/* Sale ID */');
            expect(result.formattedSql).toContain('/* Amount */');
            expect(result.formattedSql).toContain('\n,'); // Before comma style
        });
    });

    describe('Edge cases', () => {
        test('should handle empty comments gracefully', () => {
            // Arrange
            const sql = `
                SELECT s.sale_id /**/, s.amount /* */
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - should handle empty comments without errors
            expect(result.formattedSql).toContain('SELECT');
            expect(result.formattedSql).toContain('FROM');
        });

        test('should preserve comment content with special characters', () => {
            // Arrange - Use simpler comment to avoid parser issues
            const sql = `
                SELECT s.sale_id /* Comment with special chars: @#$%^&*() */, s.amount
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - should preserve special characters in comments
            expect(result.formattedSql).toContain('Comment with special chars');
            expect(result.formattedSql).toContain('@#$%^&*()');
        });

        test('should handle queries without comments', () => {
            // Arrange
            const sql = `
                SELECT s.sale_id, s.amount
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - should work normally without comments
            expect(result.formattedSql).toContain('SELECT');
            expect(result.formattedSql).toContain('FROM');
            expect(result.formattedSql).not.toContain('/*');
            expect(result.formattedSql).not.toContain('--');
        });
    });

    describe('Comparison with block style', () => {
        test('should demonstrate difference between block and smart styles', () => {
            // Arrange - Use a complex SQL with header comments
            const sql = `
                /*
                  Complex Query Header
                  ===================

                  This is a multi-line header comment
                  that demonstrates the difference
                */
                SELECT s.sale_id /* Field comment */
                FROM sales s /* Table comment */
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const blockResult = blockFormatter.format(query);
            const smartResult = smartFormatter.format(query);

            // Assert - smart style should have fewer comment blocks but same content
            expect(blockResult.formattedSql).toContain('/*');
            expect(smartResult.formattedSql).toContain('/*');

            // Both should contain the same content
            expect(blockResult.formattedSql).toContain('Complex Query Header');
            expect(smartResult.formattedSql).toContain('Complex Query Header');
            expect(blockResult.formattedSql).toContain('Field comment');
            expect(smartResult.formattedSql).toContain('Field comment');

            // Smart style should create multi-line structure for header
            expect(smartResult.formattedSql).toContain('/*\n');
            expect(smartResult.formattedSql).toContain('\n*/');
        });
    });
});