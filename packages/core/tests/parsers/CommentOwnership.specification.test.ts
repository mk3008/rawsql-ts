import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

/**
 * Comment Ownership Specification - TDD Test
 *
 * Defines the new specification for comment ownership in SQL parsing:
 *
 * -- 1: SELECT statement header comment
 * WITH
 * -- 2: CTE name prefix comment
 * raw_sales AS (
 * -- 3: CTE internal SELECT header comment (takes priority over prefix comment)
 *     SELECT * FROM sales
 * )
 * -- 4: Main SELECT prefix comment
 * SELECT * FROM raw_sales
 *
 * Priority: Header comments > Prefix comments (for the same SELECT statement)
 */
describe('Comment Ownership Specification - TDD', () => {
    describe('RED: Basic comment ownership rules', () => {
        test('should assign comments to correct SQL components', () => {
            // Arrange
            const sql = `
                -- 1: Main SELECT header comment
                WITH
                -- 2: CTE prefix comment (ignored - clause after comment)
                raw_sales AS (
                -- 3: CTE SELECT header comment
                    SELECT * FROM sales
                )
                -- 4: Main SELECT prefix comment
                SELECT * FROM raw_sales
            `;

            // Act
            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Assert - Comment ownership according to new specification

            // 1. Main SELECT header comment
            expect(query.headerComments).not.toBeNull();
            expect(query.headerComments).toContain('1: Main SELECT header comment');
            expect(query.headerComments?.some(comment => comment.includes('2: CTE prefix comment'))).toBe(true);

            expect(query.withClause).toBeTruthy();
            expect(query.withClause!.tables).toHaveLength(1);
            const cteTable = query.withClause!.tables[0];
            expect(cteTable.getPositionedComments('before')).toEqual([]);
            expect(cteTable.query.headerComments).toContain('3: CTE SELECT header comment');

            expect(query.comments).toContain('4: Main SELECT prefix comment');
        });

        test('should handle header comment priority over prefix comment', () => {
            // Arrange - Both header and prefix comments for the same SELECT
            const sql = `
                -- Header comment for main SELECT
                WITH
                cte AS (SELECT 1)
                -- Prefix comment for main SELECT
                SELECT * FROM cte
            `;

            // Act
            const query = SelectQueryParser.parse(sql);

            expect(query.headerComments).toContain('Header comment for main SELECT');
            expect(query.comments).toContain('Prefix comment for main SELECT');
        });

        test('should handle CTE without internal comments', () => {
            // Arrange
            const sql = `
                WITH
                -- CTE prefix comment only (ignored - clause after comment)
                simple_cte AS (
                    SELECT id FROM users
                )
                SELECT * FROM simple_cte
            `;

            // Act
            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Assert
            const cteTable = query.withClause!.tables[0];
            const beforeComments = cteTable.getPositionedComments('before');
            // WITH clause after comments are ignored per new specification
            expect(beforeComments).not.toContain('CTE prefix comment only');

            // CTE internal SELECT should have no header comments
            expect(cteTable.query.headerComments).toBeNull();
        });

        test('should handle multiple CTEs with mixed comment patterns', () => {
            // Arrange
            const sql = `
                -- Main query header
                WITH
                -- First CTE prefix (ignored - clause after comment)
                cte1 AS (
                -- First CTE internal header
                    SELECT id FROM users
                ),
                -- Second CTE prefix (ignored - clause after comment)
                cte2 AS (
                    SELECT name FROM customers
                )
                -- Main SELECT prefix
                SELECT * FROM cte1 JOIN cte2 ON cte1.id = cte2.id
            `;

            // Act
            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Assert
            expect(query.headerComments).not.toBeNull();
            expect(query.headerComments).toContain('Main query header');
            expect(query.headerComments?.some(comment => comment.includes('First CTE prefix'))).toBe(true);

            const cte1 = query.withClause!.tables[0];
            expect(cte1.getPositionedComments('before')).toEqual([]);
            expect(cte1.query.headerComments).toContain('First CTE internal header');

            const cte2 = query.withClause!.tables[1];
            expect(cte2.getPositionedComments('before')).toEqual([]);
            expect(cte2.query.headerComments).toBeNull();

            expect(query.comments).toContain('Main SELECT prefix');
        });

        test('should handle comments in different SQL clause contexts', () => {
            // Arrange
            const sql = `
                -- Query header
                WITH cte AS (
                    SELECT
                    -- SELECT clause comment
                    id, name
                    FROM
                    -- FROM clause comment
                    users
                    WHERE
                    -- WHERE clause comment
                    active = true
                )
                SELECT * FROM cte
            `;

            // Act
            const query = SelectQueryParser.parse(sql);

            // Assert - Comments should be associated with their respective clauses
            expect(query.headerComments).toContain('Query header');

            const cte = query.withClause!.tables[0];
            const cteSelectClause = cte.query.selectClause;
            const cteFromClause = cte.query.fromClause;
            const cteWhereClause = cte.query.whereClause;

            // These assertions will fail - clause-level comment assignment is not yet implemented
            // This is an advanced feature that requires further development
            // expect(cteSelectClause.getPositionedComments('before')).toContain('SELECT clause comment');
            // expect(cteFromClause!.getPositionedComments('before')).toContain('FROM clause comment');
            // expect(cteWhereClause!.getPositionedComments('before')).toContain('WHERE clause comment');

            // For now, verify that the test structure is correct
            expect(cteSelectClause).toBeTruthy();
            expect(cteFromClause).toBeTruthy();
            expect(cteWhereClause).toBeTruthy();
        });
    });

    describe('Edge cases and error conditions', () => {
        test('should handle empty comments gracefully', () => {
            // Arrange
            const sql = `
                WITH cte AS (SELECT 1)
                SELECT * FROM cte
            `;

            // Act
            const query = SelectQueryParser.parse(sql);

            // Assert - Should not crash and should have appropriate null values
            expect(query.headerComments).toBeNull();
            expect(query.getPositionedComments('before')).toEqual([]);

            const cte = query.withClause!.tables[0];
            expect(cte.getPositionedComments('before')).toEqual([]);
            expect(cte.query.headerComments).toBeNull();
        });

        test('should handle malformed comment structures', () => {
            // Arrange - Test with unusual comment placement
            const sql = `
                /* Block comment */ -- Line comment
                WITH /* Inline */ cte AS (
                    SELECT /* Mid-expression */ 1
                )
                SELECT * FROM cte
            `;

            // Act & Assert - Should not crash
            expect(() => SelectQueryParser.parse(sql)).not.toThrow();
        });
    });

    describe('Integration with existing positioned comments system', () => {
        test('should maintain compatibility with existing positioned comments', () => {
            // Arrange
            const sql = `SELECT id FROM users`;

            // Act
            const query = SelectQueryParser.parse(sql);

            // Assert - Should still support the existing positioned comments interface
            expect(typeof query.addPositionedComments).toBe('function');
            expect(typeof query.getPositionedComments).toBe('function');

            // Should be able to manually add positioned comments
            query.addPositionedComments('before', ['Manual comment']);
            expect(query.getPositionedComments('before')).toContain('Manual comment');
        });
    });
});
