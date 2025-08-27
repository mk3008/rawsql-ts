import { describe, it, expect } from 'vitest';
import { SmartRenamer } from '../../src/transformers/SmartRenamer';

/**
 * Tests for SmartRenamer - unified CTE and Alias renaming with automatic detection
 */
describe('SmartRenamer', () => {
    const renamer = new SmartRenamer();

    describe('CTE Name Detection and Renaming', () => {
        it('should detect and rename CTE name correctly', () => {
            const sql = `WITH user_data AS (
                SELECT id, name FROM users WHERE active = true
            )
            SELECT * FROM user_data WHERE user_data.name IS NOT NULL`;

            // Click on 'user_data' in the WITH clause
            const result = renamer.rename(sql, { line: 1, column: 6 }, 'customer_data');
            
            expect(result.success).toBe(true);
            expect(result.renamerType).toBe('cte');
            expect(result.originalName).toBe('user_data');
            expect(result.newName).toBe('customer_data');
            expect(result.newSql).toContain('with "customer_data" as');
            expect(result.newSql).toContain('from "customer_data"');
            expect(result.newSql).not.toContain('user_data');
        });

        it('should detect CTE when clicked on reference in main query', () => {
            const sql = `WITH order_data AS (SELECT * FROM orders)
            SELECT order_data.id FROM order_data`;

            // Click on 'order_data' in the SELECT clause (should still detect as CTE)
            const result = renamer.rename(sql, { line: 2, column: 20 }, 'order_info');
            
            expect(result.success).toBe(true);
            expect(result.renamerType).toBe('cte');
            expect(result.originalName).toBe('order_data');
        });
    });

    describe('Table Alias Detection and Renaming', () => {
        it('should detect and rename table alias correctly', () => {
            const sql = 'SELECT u.name, u.email FROM users u WHERE u.active = true';

            // Click on 'u' table alias
            const result = renamer.rename(sql, { line: 1, column: 8 }, 'customer');
            
            expect(result.success).toBe(true);
            expect(result.renamerType).toBe('alias');
            expect(result.originalName).toBe('u');
            expect(result.newName).toBe('customer');
            expect(result.newSql).toContain('SELECT customer.name, customer.email');
            expect(result.newSql).toContain('FROM users customer');
            expect(result.newSql).toContain('WHERE customer.active = true');
        });

        it('should handle complex alias renaming with JOINs', () => {
            const sql = `SELECT u.name, o.date 
                         FROM users u 
                         JOIN orders o ON u.id = o.user_id 
                         WHERE u.active = true`;

            // Click on the first 'u' alias
            const result = renamer.rename(sql, { line: 1, column: 8 }, 'usr');
            
            expect(result.success).toBe(true);
            expect(result.renamerType).toBe('alias');
            expect(result.newSql).toContain('SELECT usr.name');
            expect(result.newSql).toContain('FROM users usr');
            expect(result.newSql).toContain('ON usr.id = o.user_id');
            expect(result.newSql).toContain('WHERE usr.active = true');
            // 'o' should remain unchanged
            expect(result.newSql).toContain('o.date');
            expect(result.newSql).toContain('JOIN orders o');
        });
    });

    describe('Mixed CTE and Alias Scenarios', () => {
        it('should correctly distinguish between CTE and table alias in same query', () => {
            const sql = `WITH user_data AS (
                SELECT u.id, u.name FROM users u WHERE u.active = true
            )
            SELECT user_data.name FROM user_data`;

            // Test CTE renaming - click on 'user_data' in WITH clause
            const cteResult = renamer.rename(sql, { line: 1, column: 6 }, 'customer_data');
            expect(cteResult.success).toBe(true);
            expect(cteResult.renamerType).toBe('cte');
            expect(cteResult.newSql).toContain('with "customer_data" as');

            // Test alias renaming - click on 'u' in the CTE definition  
            const aliasResult = renamer.rename(sql, { line: 2, column: 24 }, 'usr');
            expect(aliasResult.success).toBe(true);
            expect(aliasResult.renamerType).toBe('alias');
            expect(aliasResult.newSql).toContain('SELECT usr.id, usr.name FROM users usr');
        });

        it('should handle nested scenarios correctly', () => {
            const sql = `WITH enriched_users AS (
                SELECT u.id, u.name, o.count
                FROM users u
                LEFT JOIN (SELECT user_id, COUNT(*) as count FROM orders GROUP BY user_id) o 
                    ON u.id = o.user_id
                WHERE u.active = true
            )
            SELECT enriched_users.name FROM enriched_users WHERE enriched_users.count > 0`;

            // CTE rename
            const cteResult = renamer.rename(sql, { line: 1, column: 6 }, 'user_summary');
            expect(cteResult.success).toBe(true);
            expect(cteResult.renamerType).toBe('cte');
            
            // Table alias rename (should work for 'u')
            const aliasResult = renamer.rename(sql, { line: 2, column: 24 }, 'usr');
            expect(aliasResult.success).toBe(true);
            expect(aliasResult.renamerType).toBe('alias');
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid positions', () => {
            const sql = 'SELECT * FROM users u';
            
            // Position with no lexeme
            const result = renamer.rename(sql, { line: 1, column: 7 }, 'new_name');
            expect(result.success).toBe(false);
            expect(result.error).toContain('No identifier found');
        });

        it('should handle non-identifier tokens', () => {
            const sql = 'SELECT * FROM users u';
            
            // Click on '*' (not an identifier)
            const result = renamer.rename(sql, { line: 1, column: 9 }, 'new_name');
            expect(result.success).toBe(false);
            expect(result.error).toContain('No identifier found');
        });

        it('should handle alias rename conflicts', () => {
            const sql = 'SELECT u.name FROM users u JOIN orders o ON u.id = o.user_id';
            
            // Try to rename 'u' to 'orders' (conflicts with table name)
            const result = renamer.rename(sql, { line: 1, column: 8 }, 'orders');
            expect(result.success).toBe(false);
            expect(result.renamerType).toBe('alias');
            expect(result.error).toBeDefined();
        });

        it('should handle CTE rename conflicts', () => {
            const sql = `WITH user_data AS (SELECT * FROM users),
                 order_data AS (SELECT * FROM orders)
            SELECT * FROM user_data`;

            // Try to rename 'user_data' to 'order_data'
            const result = renamer.rename(sql, { line: 1, column: 6 }, 'order_data');
            expect(result.success).toBe(false);
            expect(result.renamerType).toBe('cte');
            expect(result.error).toContain('already exists');
        });

        it('should validate input parameters', () => {
            // Empty SQL
            let result = renamer.rename('', { line: 1, column: 1 }, 'new_name');
            expect(result.success).toBe(false);
            expect(result.error).toContain('SQL cannot be empty');

            // Invalid position
            result = renamer.rename('SELECT 1', { line: 0, column: 1 }, 'new_name');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Position must be valid');

            // Empty new name
            result = renamer.rename('SELECT 1', { line: 1, column: 1 }, '');
            expect(result.success).toBe(false);
            expect(result.error).toContain('New name cannot be empty');
        });
    });

    describe('Renameability Check', () => {
        it('should identify renameable CTE names', () => {
            const sql = `WITH user_data AS (SELECT * FROM users) SELECT * FROM user_data`;
            
            // CTE name in WITH clause
            const result1 = renamer.isRenameable(sql, { line: 1, column: 6 });
            expect(result1.renameable).toBe(true);
            expect(result1.renamerType).toBe('cte');
            expect(result1.tokenName).toBe('user_data');

            // CTE name in main query
            const result2 = renamer.isRenameable(sql, { line: 1, column: 58 });
            expect(result2.renameable).toBe(true);
            expect(result2.renamerType).toBe('cte');
            expect(result2.tokenName).toBe('user_data');
        });

        it('should identify renameable table aliases', () => {
            const sql = 'SELECT u.name FROM users u WHERE u.active = true';
            
            const result = renamer.isRenameable(sql, { line: 1, column: 8 });
            expect(result.renameable).toBe(true);
            expect(result.renamerType).toBe('alias');
            expect(result.tokenName).toBe('u');
        });

        it('should reject non-renameable tokens', () => {
            const sql = 'SELECT u.name FROM users u WHERE u.active = true';
            
            // Keyword 'SELECT'
            const result1 = renamer.isRenameable(sql, { line: 1, column: 1 });
            expect(result1.renameable).toBe(false);
            expect(result1.renamerType).toBe('none');
            expect(result1.reason).toContain('not an identifier');

            // Keywords
            const result2 = renamer.isRenameable(sql, { line: 1, column: 15 });
            expect(result2.renameable).toBe(false);
            expect(result2.renamerType).toBe('none');
        });

        it('should handle invalid positions', () => {
            const sql = 'SELECT * FROM users u';
            
            // Position with no token
            const result = renamer.isRenameable(sql, { line: 1, column: 100 });
            expect(result.renameable).toBe(false);
            expect(result.renamerType).toBe('none');
            expect(result.reason).toBe('No token found');
        });

        it('should handle empty or invalid inputs', () => {
            // Empty SQL
            let result = renamer.isRenameable('', { line: 1, column: 1 });
            expect(result.renameable).toBe(false);
            expect(result.reason).toBe('Empty SQL');

            // Invalid position
            result = renamer.isRenameable('SELECT 1', { line: 0, column: 1 });
            expect(result.renameable).toBe(false);
            expect(result.reason).toBe('Invalid position');
        });
    });

    describe('Return Value Structure', () => {
        it('should return complete result structure on success', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.rename(sql, { line: 1, column: 8 }, 'customer');

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('originalSql');
            expect(result).toHaveProperty('newSql');
            expect(result).toHaveProperty('renamerType');
            expect(result).toHaveProperty('originalName');
            expect(result).toHaveProperty('newName');
            
            expect(result.success).toBe(true);
            expect(result.originalSql).toBe(sql);
            expect(result.renamerType).toBe('alias');
            expect(result.originalName).toBe('u');
            expect(result.newName).toBe('customer');
            expect(result.newSql).toBeDefined();
        });

        it('should return complete error structure on failure', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.rename(sql, { line: 1, column: 100 }, 'customer');

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('originalSql');
            expect(result).toHaveProperty('renamerType');
            expect(result).toHaveProperty('originalName');
            expect(result).toHaveProperty('newName');
            expect(result).toHaveProperty('error');
            
            expect(result.success).toBe(false);
            expect(result.newSql).toBeUndefined();
            expect(result.error).toBeDefined();
        });
    });
});