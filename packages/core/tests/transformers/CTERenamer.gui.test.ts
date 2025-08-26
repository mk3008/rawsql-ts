import { describe, it, expect } from 'vitest';
import { CTERenamer } from '../../src/transformers/CTERenamer';

/**
 * Tests for CTERenamer GUI integration capabilities
 */
describe('CTERenamer GUI Integration', () => {
    const renamer = new CTERenamer();

    describe('Position-based CTE Renaming', () => {
        it('should rename CTE by position in WITH clause', () => {
            const sql = `WITH user_data AS (
                SELECT id, name FROM users WHERE active = true
            )
            SELECT * FROM user_data WHERE user_data.name IS NOT NULL`;

            // Click on 'user_data' at line 1, column 6
            const result = renamer.renameCTEAtPosition(sql, { line: 1, column: 6 }, 'customer_data');
            
            expect(result).toContain('with "customer_data" as');
            expect(result).toContain('from "customer_data"');
            expect(result).toContain('"customer_data"."name" is not null');
            expect(result).not.toContain('user_data');
        });

        it('should rename CTE when clicked on reference in main query', () => {
            const sql = `WITH user_data AS (SELECT id, name FROM users)
            SELECT user_data.name FROM user_data`;

            // Click on 'user_data' in the SELECT clause (line 2, column 20)
            const result = renamer.renameCTEAtPosition(sql, { line: 2, column: 20 }, 'customers');
            
            expect(result).toContain('with "customers" as');
            expect(result).toContain('select "customers"."name" from "customers"');
            expect(result).not.toContain('user_data');
        });

        it('should handle multiple CTEs and rename only the selected one', () => {
            const sql = `WITH user_data AS (SELECT * FROM users),
                 order_data AS (SELECT * FROM orders)
            SELECT * FROM user_data JOIN order_data ON user_data.id = order_data.user_id`;

            // Click on 'user_data' in the WITH clause
            const result = renamer.renameCTEAtPosition(sql, { line: 1, column: 6 }, 'customer_data');
            
            expect(result).toContain('with "customer_data" as');
            expect(result).toContain('"order_data" as'); // Should remain unchanged
            expect(result).toContain('from "customer_data" join "order_data"');
            expect(result).toContain('"customer_data"."id" = "order_data"."user_id"');
            expect(result).not.toContain('user_data');
        });

        it('should handle nested CTE references', () => {
            const sql = `WITH user_data AS (
                SELECT id, name FROM users
            ),
            enriched_data AS (
                SELECT user_data.id, user_data.name, 'active' as status
                FROM user_data
                WHERE user_data.id > 0  
            )
            SELECT * FROM enriched_data`;

            // Rename the referenced CTE 'user_data' 
            const result = renamer.renameCTEAtPosition(sql, { line: 1, column: 6 }, 'base_users');
            
            expect(result).toContain('with "base_users" as');
            expect(result).toContain('select "base_users"."id", "base_users"."name"');
            expect(result).toContain('from "base_users"');
            expect(result).toContain('where "base_users"."id" > 0');
            expect(result).not.toContain('user_data');
        });
    });

    describe('Error Handling', () => {
        it('should throw error when position has no lexeme', () => {
            const sql = `WITH user_data AS (SELECT * FROM users) SELECT * FROM user_data`;
            
            // Click on whitespace
            expect(() => {
                renamer.renameCTEAtPosition(sql, { line: 1, column: 5 }, 'new_name');
            }).toThrow('No CTE name found at line 1, column 5');
        });

        it('should throw error when lexeme is not a CTE name', () => {
            const sql = `WITH user_data AS (SELECT id FROM users) SELECT * FROM user_data`;
            
            // Click on 'SELECT' keyword (not a CTE name)
            expect(() => {
                renamer.renameCTEAtPosition(sql, { line: 1, column: 20 }, 'new_name');
            }).toThrow("'select' is not a CTE name in this query");
        });

        it('should throw error when new name conflicts with existing CTE', () => {
            const sql = `WITH user_data AS (SELECT * FROM users),
                 order_data AS (SELECT * FROM orders)
            SELECT * FROM user_data`;

            // Try to rename 'user_data' to 'order_data' (conflict)
            expect(() => {
                renamer.renameCTEAtPosition(sql, { line: 1, column: 6 }, 'order_data');
            }).toThrow("CTE name 'order_data' already exists");
        });

        it('should throw error when new name is a reserved SQL keyword', () => {
            const sql = `WITH user_data AS (SELECT * FROM users) SELECT * FROM user_data`;
            
            // Try to rename 'user_data' to reserved keyword 'select'
            expect(() => {
                renamer.renameCTEAtPosition(sql, { line: 1, column: 6 }, 'select');
            }).toThrow("'select' is a reserved SQL keyword and should not be used as a CTE name");
        });

        it('should throw error for multiple common reserved keywords', () => {
            const sql = `WITH user_data AS (SELECT * FROM users) SELECT * FROM user_data`;
            const reservedKeywords = ['from', 'where', 'with', 'as', 'union', 'select', 'limit'];
            
            for (const keyword of reservedKeywords) {
                expect(() => {
                    renamer.renameCTEAtPosition(sql, { line: 1, column: 6 }, keyword);
                }).toThrow(`'${keyword}' is a reserved SQL keyword and should not be used as a CTE name`);
            }
        });

        it('should throw error for invalid positions', () => {
            const sql = `WITH user_data AS (SELECT * FROM users) SELECT * FROM user_data`;
            
            expect(() => {
                renamer.renameCTEAtPosition(sql, { line: 0, column: 1 }, 'new_name');
            }).toThrow('Position must be a valid line/column (1-based)');
            
            expect(() => {
                renamer.renameCTEAtPosition(sql, { line: 1, column: 0 }, 'new_name');
            }).toThrow('Position must be a valid line/column (1-based)');
        });

        it('should throw error for empty inputs', () => {
            expect(() => {
                renamer.renameCTEAtPosition('', { line: 1, column: 1 }, 'new_name');
            }).toThrow('SQL cannot be empty');
            
            expect(() => {
                renamer.renameCTEAtPosition('WITH user_data AS (SELECT 1)', { line: 1, column: 6 }, '');
            }).toThrow('New CTE name cannot be empty');
        });
    });

    describe('Complex Scenarios', () => {
        it('should handle CTE with column aliases', () => {
            const sql = `WITH user_summary(user_id, full_name, order_count) AS (
                SELECT u.id, u.name, COUNT(o.id)
                FROM users u LEFT JOIN orders o ON u.id = o.user_id
                GROUP BY u.id, u.name
            )
            SELECT user_summary.full_name FROM user_summary WHERE user_summary.order_count > 0`;

            const result = renamer.renameCTEAtPosition(sql, { line: 1, column: 6 }, 'customer_summary');
            
            expect(result).toContain('with "customer_summary"("user_id", "full_name", "order_count") as');
            expect(result).toContain('select "customer_summary"."full_name" from "customer_summary"');
            expect(result).toContain('where "customer_summary"."order_count" > 0');
        });

        it('should preserve formatting while renaming', () => {
            const sql = `WITH
    user_data AS (
        SELECT * FROM users
    )
SELECT * FROM user_data`;

            const result = renamer.renameCTEAtPosition(sql, { line: 2, column: 5 }, 'customer_data');
            
            // Should contain the new name
            expect(result).toContain('customer_data');
            expect(result).not.toContain('user_data');
            
            // Basic structure should be maintained (though exact formatting may differ)
            expect(result).toContain('with');
            expect(result).toContain('as (');
            expect(result).toContain('select * from');
        });
    });
});