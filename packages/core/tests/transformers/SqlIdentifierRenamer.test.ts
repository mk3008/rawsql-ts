import { describe, it, expect, beforeEach } from 'vitest';
import { SqlIdentifierRenamer } from '../../src/transformers/SqlIdentifierRenamer';

describe('SqlIdentifierRenamer', () => {
    let renamer: SqlIdentifierRenamer;

    beforeEach(() => {
        renamer = new SqlIdentifierRenamer();
    });

    describe('renameIdentifiers', () => {
        it('should rename multiple identifiers while preserving formatting', () => {
            const originalSql = `-- User query
SELECT DISTINCT 
    u.id AS user_id,  /* user identifier */
    u.name,
    u.email
FROM 
    users AS u
    LEFT JOIN orders o ON u.id = o.user_id
WHERE 
    u.active = TRUE;`;

            const renames = new Map([
                ['u', 'users_tbl'],
                ['user_id', 'userId'],
                ['o', 'orders_tbl']
            ]);

            const result = renamer.renameIdentifiers(originalSql, renames);

            // Check that formatting is preserved
            expect(result).toContain('-- User query');
            expect(result).toContain('/* user identifier */');
            expect(result).toContain('SELECT DISTINCT \n    users_tbl.id AS userId,');
            expect(result).toContain('FROM \n    users AS users_tbl');
            expect(result).toContain('LEFT JOIN orders orders_tbl ON users_tbl.id = orders_tbl.userId');
        });

        it('should return original SQL when no renames provided', () => {
            const sql = 'SELECT * FROM users u';
            const renames = new Map<string, string>();
            
            const result = renamer.renameIdentifiers(sql, renames);
            
            expect(result).toBe(sql);
        });
    });

    describe('renameIdentifier', () => {
        it('should handle table.column references correctly', () => {
            const originalSql = 'SELECT u.id, u.name FROM users u WHERE u.active = TRUE';
            
            const result = renamer.renameIdentifier(originalSql, 'u', 'user_table');
            
            expect(result).toBe('SELECT user_table.id, user_table.name FROM users user_table WHERE user_table.active = TRUE');
        });

        it('should handle quoted identifiers', () => {
            const originalSql = 'SELECT "user"."id", [user].[name] FROM `users` AS "user"';
            
            const result = renamer.renameIdentifier(originalSql, 'user', 'customer');
            
            expect(result).toContain('"customer"."id"');
            expect(result).toContain('[customer].[name]');
            expect(result).toContain('AS "customer"');
        });

        it('should handle AS alias patterns', () => {
            const originalSql = 'SELECT u.id AS user_id, u.name AS user_name FROM users AS u';
            
            const result = renamer.renameIdentifier(originalSql, 'user_id', 'userId');
            
            expect(result).toBe('SELECT u.id AS userId, u.name AS user_name FROM users AS u');
        });

        it('should not rename partial matches', () => {
            const originalSql = 'SELECT user_id, super_user_id FROM users';
            
            const result = renamer.renameIdentifier(originalSql, 'user_id', 'userId');
            
            expect(result).toBe('SELECT userId, super_user_id FROM users');
        });

        it('should handle case-insensitive matching', () => {
            const originalSql = 'SELECT User.ID, USER.name FROM Users AS User';
            
            const result = renamer.renameIdentifier(originalSql, 'User', 'Customer');
            
            expect(result).toContain('Customer.ID');
            expect(result).toContain('AS Customer');
        });

        it('should return original SQL when identifiers are the same', () => {
            const originalSql = 'SELECT u.id FROM users u';
            
            const result = renamer.renameIdentifier(originalSql, 'u', 'u');
            
            expect(result).toBe(originalSql);
        });
    });

    describe('validateRename', () => {
        it('should return true for successful renames', () => {
            const originalSql = 'SELECT u.id FROM users u';
            const modifiedSql = 'SELECT customer.id FROM users customer';
            
            const isValid = renamer.validateRename(originalSql, modifiedSql, 'u', 'customer');
            
            expect(isValid).toBe(true);
        });

        it('should return false when no changes were made', () => {
            const originalSql = 'SELECT u.id FROM users u';
            const modifiedSql = originalSql;
            
            const isValid = renamer.validateRename(originalSql, modifiedSql, 'u', 'customer');
            
            expect(isValid).toBe(false);
        });

        it('should return false when new identifier is not present', () => {
            const originalSql = 'SELECT u.id FROM users u';
            const modifiedSql = 'SELECT something_else FROM users u';
            
            const isValid = renamer.validateRename(originalSql, modifiedSql, 'u', 'customer');
            
            expect(isValid).toBe(false);
        });

        it('should return false when old identifier count did not decrease', () => {
            const originalSql = 'SELECT u.id FROM users u';
            const modifiedSql = 'SELECT u.id FROM users u'; // No actual replacement
            
            const isValid = renamer.validateRename(originalSql, modifiedSql, 'u', 'customer');
            
            expect(isValid).toBe(false);
        });
    });

    describe('Practical Demo - Full Text Comparison', () => {
        it('should demonstrate complete CTE rename workflow', () => {
            const originalSql = `-- User management query
WITH user_data AS (
    SELECT 
        id,
        name,
        email
    FROM users 
    WHERE active = TRUE
),
order_stats AS (
    SELECT 
        user_id,
        COUNT(*) as order_count,
        SUM(amount) as total_amount
    FROM orders 
    GROUP BY user_id
)
SELECT 
    u.id,
    u.name,
    u.email,
    COALESCE(o.order_count, 0) as orders,
    COALESCE(o.total_amount, 0) as spent
FROM user_data u
LEFT JOIN order_stats o ON u.id = o.user_id
ORDER BY u.name`;

            // Step 1: Right-click on "user_data" in CTE definition
            const clickPosition = { line: 2, column: 6 }; // "u" in "user_data"
            
            // Step 2: Check if renaming is possible
            const renameCheck = renamer.checkRenameability(originalSql, clickPosition);
            
            expect(renameCheck.canRename).toBe(true);
            expect(renameCheck.currentName).toBe('user_data');
            expect(renameCheck.type).toBe('cte');
            expect(renameCheck.scopeRange).toEqual({ start: 0, end: originalSql.length });
            
            // Step 3: User enters new name and executes rename
            const renamedSql = renamer.renameAtPosition(originalSql, clickPosition, 'active_users');
            
            // Step 4: Verify complete transformation
            const expectedSql = `-- User management query
WITH active_users AS (
    SELECT 
        id,
        name,
        email
    FROM users 
    WHERE active = TRUE
),
order_stats AS (
    SELECT 
        user_id,
        COUNT(*) as order_count,
        SUM(amount) as total_amount
    FROM orders 
    GROUP BY user_id
)
SELECT 
    u.id,
    u.name,
    u.email,
    COALESCE(o.order_count, 0) as orders,
    COALESCE(o.total_amount, 0) as spent
FROM active_users u
LEFT JOIN order_stats o ON u.id = o.user_id
ORDER BY u.name`;

            expect(renamedSql).toBe(expectedSql);
        });

        it('should demonstrate scoped table alias rename workflow', () => {
            const originalSql = `-- Complex multi-CTE query with same alias names
WITH user_reports AS (
    SELECT 
        u.id,
        u.name,
        u.department_id
    FROM users u  -- First 'u' scope
    WHERE u.status = 'active'
),
department_stats AS (
    SELECT 
        u.department_id,
        COUNT(*) as user_count
    FROM users u  -- Second 'u' scope (different from first)
    WHERE u.status = 'active'
    GROUP BY u.department_id
)
SELECT 
    ur.name,
    ds.user_count
FROM user_reports ur
JOIN department_stats ds ON ur.department_id = ds.department_id`;

            // Step 1: Right-click on first "u" (in first CTE)
            const firstUPosition = { line: 4, column: 9 }; // "u" in "u.id"
            
            // Step 2: Check renaming possibility
            const firstCheck = renamer.checkRenameability(originalSql, firstUPosition);
            expect(firstCheck.canRename).toBe(true);
            expect(firstCheck.currentName).toBe('u');
            expect(firstCheck.type).toBe('table_alias');
            expect(firstCheck.scopeRange!.start).toBeGreaterThan(0);
            expect(firstCheck.scopeRange!.end).toBeLessThan(originalSql.length);
            
            // Step 3: Rename only first 'u' to 'user_tbl'
            const renamedSql = renamer.renameAtPosition(originalSql, firstUPosition, 'user_tbl');
            
            // Step 4: Verify only first scope was renamed
            const expectedSql = `-- Complex multi-CTE query with same alias names
WITH user_reports AS (
    SELECT 
        user_tbl.id,
        user_tbl.name,
        user_tbl.department_id
    FROM users user_tbl  -- First 'u' scope
    WHERE user_tbl.status = 'active'
),
department_stats AS (
    SELECT 
        u.department_id,
        COUNT(*) as user_count
    FROM users u  -- Second 'u' scope (different from first)
    WHERE u.status = 'active'
    GROUP BY u.department_id
)
SELECT 
    ur.name,
    ds.user_count
FROM user_reports ur
JOIN department_stats ds ON ur.department_id = ds.department_id`;

            expect(renamedSql).toBe(expectedSql);
            
            // Step 5: Demonstrate that second 'u' is still renameable independently
            const secondUPosition = { line: 12, column: 9 }; // "u" in "u.department_id"
            const secondCheck = renamer.checkRenameability(renamedSql, secondUPosition);
            expect(secondCheck.canRename).toBe(true);
            expect(secondCheck.currentName).toBe('u');
            expect(secondCheck.type).toBe('table_alias');
        });

        it('should detect and reject rename attempts in invalid contexts', () => {
            const originalSql = `SELECT 
    id,
    'user_data' as label,  -- String literal
    COUNT(*) 
FROM users 
WHERE status = 'active'`;

            // Try to rename inside string literal
            const invalidPosition = { line: 3, column: 6 }; // Inside 'user_data'
            const check = renamer.checkRenameability(originalSql, invalidPosition);
            
            expect(check.canRename).toBe(false);
            expect(check.reason).toContain('string literal');
            
            // Verify that attempting to rename throws error
            expect(() => {
                renamer.renameAtPosition(originalSql, invalidPosition, 'new_name');
            }).toThrow();
        });
    });

    describe('GUI workflow - renameability check and execution', () => {
        it('should check if CTE name can be renamed', () => {
            const sql = `WITH user_data AS (
  SELECT id FROM users
)
SELECT * FROM user_data`;
            
            // Right-click on "user_data" (CTE name)
            const position = { line: 1, column: 6 }; // "u" in "user_data"
            const check = renamer.checkRenameability(sql, position);
            
            expect(check.canRename).toBe(true);
            expect(check.currentName).toBe('user_data');
            expect(check.type).toBe('cte');
            expect(check.scopeRange).toEqual({ start: 0, end: sql.length }); // Global scope
        });

        it('should check if table alias can be renamed', () => {
            const sql = `WITH data1 AS (
  SELECT u.id FROM users AS u
),
data2 AS (
  SELECT u.name FROM accounts AS u
)
SELECT * FROM data1, data2`;
            
            // Right-click on first "u" (table alias)
            const position = { line: 2, column: 10 }; // First "u.id"
            const check = renamer.checkRenameability(sql, position);
            
            expect(check.canRename).toBe(true);
            expect(check.currentName).toBe('u');
            expect(check.type).toBe('table_alias');
            expect(check.scopeRange!.start).toBeGreaterThan(0); // Local scope only
            expect(check.scopeRange!.end).toBeLessThan(sql.length);
        });

        it('should detect non-renameable positions', () => {
            const sql = "SELECT id FROM users WHERE status = 'active'";
            
            // Right-click on string literal
            const position = { line: 1, column: 40 }; // Inside 'active'
            const check = renamer.checkRenameability(sql, position);
            
            expect(check.canRename).toBe(false);
            expect(check.reason).toContain('string literal');
        });

        it('should execute rename at position for CTE', () => {
            const sql = `WITH user_data AS (
  SELECT id FROM users
)
SELECT * FROM user_data`;
            
            const position = { line: 1, column: 6 }; // "user_data"
            const result = renamer.renameAtPosition(sql, position, 'customers');
            
            expect(result).toContain('WITH customers AS');
            expect(result).toContain('FROM customers');
        });

        it('should execute rename at position for table alias with correct scope', () => {
            const sql = `WITH data1 AS (
  SELECT u.id FROM users AS u
),
data2 AS (
  SELECT u.name FROM accounts AS u
)
SELECT * FROM data1, data2`;
            
            // Rename only the first "u"
            const position = { line: 2, column: 10 }; // First "u.id"
            const result = renamer.renameAtPosition(sql, position, 'users_tbl');
            
            // First u should be renamed
            expect(result).toContain('SELECT users_tbl.id FROM users AS users_tbl');
            // Second u should remain unchanged
            expect(result).toContain('SELECT u.name FROM accounts AS u');
        });
    });

    describe('scope-aware renaming', () => {
        it('should only rename identifiers within specified scope range', () => {
            const originalSql = `WITH data1 AS (
  SELECT u.id FROM users AS u
),
data2 AS (
  SELECT u.name FROM accounts AS u
)
SELECT * FROM data1, data2`;
            
            // Only rename the first 'u' (in first CTE)
            const scopeRange = { start: 16, end: 49 }; // covers "SELECT u.id FROM users AS u\n)"
            const result = renamer.renameIdentifierInScope(originalSql, 'u', 'users_tbl', scopeRange);
            
            // First u should be renamed
            expect(result).toContain('SELECT users_tbl.id FROM users AS users_tbl');
            // Second u should remain unchanged
            expect(result).toContain('SELECT u.name FROM accounts AS u');
        });

        it('should handle global scope for CTE names', () => {
            const originalSql = `WITH user_data AS (
  SELECT id FROM users
),
order_data AS (
  SELECT user_id FROM orders
)
SELECT * FROM user_data JOIN order_data ON user_data.id = order_data.user_id`;
            
            // CTE name has global scope - entire SQL
            const globalScope = { start: 0, end: originalSql.length };
            const result = renamer.renameIdentifierInScope(originalSql, 'user_data', 'customers', globalScope);
            
            expect(result).toContain('WITH customers AS');
            expect(result).toContain('FROM customers JOIN');
            expect(result).toContain('ON customers.id =');
        });

        it('should fallback to full SQL when no scope range provided', () => {
            const originalSql = 'SELECT u.id FROM users u';
            
            const result = renamer.renameIdentifierInScope(originalSql, 'u', 'customer');
            
            expect(result).toBe('SELECT customer.id FROM users customer');
        });
    });

    describe('complex SQL scenarios', () => {
        it('should handle nested queries with same identifier names', () => {
            const originalSql = `
                WITH u AS (SELECT id FROM users)
                SELECT u.id FROM u
                WHERE u.id IN (SELECT u.id FROM users u WHERE u.active = TRUE)
            `;
            
            const result = renamer.renameIdentifier(originalSql, 'u', 'user_data');
            
            expect(result).toContain('WITH user_data AS');
            expect(result).toContain('SELECT user_data.id FROM user_data');
            expect(result).toContain('FROM users user_data WHERE user_data.active');
        });

        it('should preserve special SQL constructs', () => {
            const originalSql = `
                SELECT 
                    u.id,
                    COUNT(*) OVER (PARTITION BY u.department_id) as dept_count,
                    ROW_NUMBER() OVER (ORDER BY u.created_at) as row_num
                FROM users u
                WHERE u.status = 'active'
            `;
            
            const result = renamer.renameIdentifier(originalSql, 'u', 'user_table');
            
            expect(result).toContain('user_table.id');
            expect(result).toContain('PARTITION BY user_table.department_id');
            expect(result).toContain('FROM users user_table');
            expect(result).toContain('WHERE user_table.status');
            // Ensure SQL keywords are not affected
            expect(result).toContain('COUNT(*)');
            expect(result).toContain('ROW_NUMBER()');
            expect(result).toContain('ORDER BY');
        });
    });
});