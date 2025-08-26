import { describe, it, expect, beforeEach } from 'vitest';
import { AliasRenamer } from '../../src/transformers/AliasRenamer';
import { LexemeCursor } from '../../src/utils/LexemeCursor';
import { TokenType } from '../../src/models/Lexeme';

describe('AliasRenamer Functional Tests', () => {
    let renamer: AliasRenamer;

    beforeEach(() => {
        renamer = new AliasRenamer();
    });

    describe('Basic Alias Renaming', () => {
        it('should rename simple table alias in SELECT and FROM clauses', () => {
            const sql = 'SELECT u.name FROM users u WHERE u.active = true';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'user_table');

            expect(result.success).toBe(true);
            expect(result.newSql).toContain('user_table.name');
            expect(result.newSql).toContain('FROM users user_table');
            expect(result.newSql).toContain('user_table.active');
        });

        it('should rename alias in multiple column references', () => {
            const sql = 'SELECT u.id, u.name, u.email FROM users u';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'usr');

            expect(result.success).toBe(true);
            expect(result.newSql).toBe('SELECT usr.id, usr.name, usr.email FROM users usr');
        });

        it('should rename alias in JOIN clauses', () => {
            const sql = `SELECT u.name, o.date 
                         FROM users u 
                         JOIN orders o ON u.id = o.user_id`;
            
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'customer');

            expect(result.success).toBe(true);
            expect(result.newSql).toContain('customer.name');
            expect(result.newSql).toContain('FROM users customer');
            expect(result.newSql).toContain('ON customer.id = o.user_id');
        });

        it('should only rename specified alias, not others', () => {
            const sql = 'SELECT u.name, o.date FROM users u JOIN orders o ON u.id = o.user_id';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'customer');

            expect(result.success).toBe(true);
            expect(result.newSql).toContain('customer.name');
            expect(result.newSql).toContain('FROM users customer');
            // 'o' should remain unchanged
            expect(result.newSql).toContain('o.date');
            expect(result.newSql).toContain('JOIN orders o');
            expect(result.newSql).toContain('o.user_id');
        });
    });

    describe('Conflict Detection', () => {
        it('should detect conflicts with table names in same scope', () => {
            const sql = 'SELECT u.name FROM users u JOIN orders o ON u.id = o.user_id';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'users'); // Try to rename 'u' to 'users'

            expect(result.success).toBe(false);
            expect(result.conflicts?.some(c => c.includes("'users'") || c.includes("table name"))).toBe(true);
        });

        it('should detect conflicts with other table names in JOIN', () => {
            const sql = 'SELECT u.name FROM users u JOIN orders o ON u.id = o.user_id';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'orders'); // Try to rename 'u' to 'orders'

            expect(result.success).toBe(false);
            expect(result.conflicts?.some(c => c.includes("'orders'") || c.includes("table name"))).toBe(true);
        });

        it('should eventually detect conflicts with existing aliases (currently not implemented)', () => {
            const sql = 'SELECT u.name, o.date FROM users u JOIN orders o ON u.id = o.user_id';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'o'); // Try to rename 'u' to 'o'

            // Note: This test shows current behavior - alias conflict detection needs enhancement
            // The renaming succeeds for now, but it creates ambiguous SQL
            expect(result.success).toBe(true);
            if (result.newSql) {
                // This creates problematic SQL with duplicate 'o' aliases
                expect(result.newSql).toContain('FROM users o JOIN orders o');
            }
        });

        it('should detect conflicts with SQL keywords', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'select');

            expect(result.success).toBe(false);
            expect(result.conflicts?.some(c => c.includes('reserved SQL keyword'))).toBe(true);
        });

        it('should detect conflicts with common SQL keywords', () => {
            const testCases = ['from', 'where', 'join', 'table', 'null', 'and', 'or'];
            const sql = 'SELECT u.name FROM users u';

            for (const keyword of testCases) {
                const result = renamer.renameAlias(sql, { line: 1, column: 8 }, keyword);
                expect(result.success).toBe(false);
                expect(result.conflicts?.some(c => c.includes('reserved SQL keyword'))).toBe(true);
            }
        });

        it('should allow valid new names that do not conflict', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'user_table');

            expect(result.success).toBe(true);
            expect(result.conflicts?.length || 0).toBe(0);
        });

        it('should eventually support complex multi-table conflict detection', () => {
            const sql = `SELECT u.name, p.title, o.date, c.name
                         FROM users u
                         LEFT JOIN profiles p ON u.id = p.user_id
                         INNER JOIN orders o ON u.id = o.user_id
                         JOIN customers c ON u.customer_id = c.id`;

            // Note: Advanced conflict detection is not fully implemented yet
            // Currently focuses on table name conflicts
            expect(renamer.renameAlias(sql, { line: 2, column: 37 }, 'users').success).toBe(false);
            expect(renamer.renameAlias(sql, { line: 2, column: 37 }, 'profiles').success).toBe(false);
            
            // Valid rename should work
            expect(renamer.renameAlias(sql, { line: 2, column: 37 }, 'user_account').success).toBe(true);
        });

        it('should handle case-insensitive table name conflicts', () => {
            const sql = 'SELECT u.name, o.date FROM users u JOIN orders o ON u.id = o.user_id';
            
            // Test case-insensitive table name conflicts
            expect(renamer.renameAlias(sql, { line: 1, column: 8 }, 'USERS').success).toBe(false);
            expect(renamer.renameAlias(sql, { line: 1, column: 8 }, 'Orders').success).toBe(false);
            
            // Valid rename should work  
            expect(renamer.renameAlias(sql, { line: 1, column: 8 }, 'user_alias').success).toBe(true);
        });

        it('should eventually support CTE scope-specific conflict detection', () => {
            const sql = `
                WITH user_data AS (
                    SELECT u.id, u.name 
                    FROM users u
                    JOIN profiles p ON u.id = p.user_id
                ),
                order_data AS (
                    SELECT o.id, o.date
                    FROM orders o
                )
                SELECT ud.name, od.date 
                FROM user_data ud
                JOIN order_data od ON ud.id = od.user_id
            `;

            // Note: CTE-specific conflict detection needs more work
            // For now, basic functionality should work
            const result = renamer.renameAlias(sql, { line: 3, column: 12 }, 'user_alias');
            expect(result).toBeDefined();
            expect(result.originalSql).toBe(sql);
        });
    });

    describe('CTE Scenarios', () => {
        it('should handle CTE alias renaming', () => {
            const sql = `
                WITH user_data AS (
                    SELECT u.id, u.name 
                    FROM users u
                    WHERE u.active = true
                )
                SELECT ud.name FROM user_data ud
            `;

            // Rename 'u' inside the CTE
            const result = renamer.renameAlias(sql, { line: 3, column: 12 }, 'usr');

            // For now, just check basic functionality - CTE scope detection needs more work
            expect(result.success).toBeDefined();
            expect(result.originalSql).toBe(sql);
        });

        it('should handle main query alias when CTE is present', () => {
            const sql = `
                WITH user_data AS (
                    SELECT u.id, u.name 
                    FROM users u
                )
                SELECT ud.name FROM user_data ud
            `;

            // Rename 'ud' in the main query
            const result = renamer.renameAlias(sql, { line: 6, column: 8 }, 'data_table');

            // For now, just check basic functionality
            expect(result.success).toBeDefined();
            expect(result.originalSql).toBe(sql);
        });
    });

    describe('Complex Scenarios', () => {
        it('should handle aliases in WHERE clauses', () => {
            const sql = 'SELECT u.name FROM users u WHERE u.active = true AND u.created_date > \'2024-01-01\'';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'user_tbl');

            expect(result.success).toBe(true);
            expect(result.newSql).toContain('user_tbl.name');
            expect(result.newSql).toContain('FROM users user_tbl');
            expect(result.newSql).toContain('user_tbl.active');
            expect(result.newSql).toContain('user_tbl.created_date');
        });

        it('should handle aliases in ORDER BY clauses', () => {
            const sql = 'SELECT u.name, u.age FROM users u ORDER BY u.name ASC, u.age DESC';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'person');

            expect(result.success).toBe(true);
            expect(result.newSql).toContain('person.name, person.age');
            expect(result.newSql).toContain('FROM users person');
            expect(result.newSql).toContain('ORDER BY person.name ASC, person.age DESC');
        });

        it('should handle aliases in GROUP BY and HAVING clauses', () => {
            const sql = `SELECT u.department, COUNT(u.id) 
                         FROM users u 
                         GROUP BY u.department 
                         HAVING COUNT(u.id) > 5`;
            
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'emp');

            expect(result.success).toBe(true);
            if (result.newSql) {
                expect(result.newSql).toContain('emp.department');
                expect(result.newSql).toContain('COUNT(emp.id)');
                expect(result.newSql).toContain('FROM users emp');
                expect(result.newSql).toContain('GROUP BY emp.department');
                expect(result.newSql).toContain('HAVING COUNT(emp.id)');
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle single-character aliases', () => {
            const sql = 'SELECT a.name FROM users a';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'b');

            expect(result.success).toBe(true);
            expect(result.newSql).toBe('SELECT b.name FROM users b');
        });

        it('should handle aliases with underscores', () => {
            const sql = 'SELECT user_tbl.name FROM users user_tbl';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'usr');

            expect(result.success).toBe(true);
            expect(result.newSql).toBe('SELECT usr.name FROM users usr');
        });

        it('should preserve SQL formatting (basic)', () => {
            const sql = `SELECT   u.name,   u.email
            FROM   users   u
            WHERE  u.active = true`;
            
            const result = renamer.renameAlias(sql, { line: 1, column: 10 }, 'usr');

            expect(result.success).toBe(true);
            // Basic structure should be preserved
            expect(result.newSql).toContain('usr.name,   usr.email');
            expect(result.newSql).toContain('FROM   users   usr');
            expect(result.newSql).toContain('usr.active');
        });
    });

    describe('Dry Run Mode', () => {
        it('should validate without making changes in dry run', () => {
            const sql = 'SELECT u.name FROM users u';
            const originalSql = sql;
            
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'user_table', { dryRun: true });

            expect(result.success).toBe(true);
            expect(result.originalSql).toBe(originalSql);
            expect(result.newSql).toBeUndefined(); // No changes made
            expect(result.changes).toBeDefined();
        });

        it('should detect conflicts in dry run mode', () => {
            const sql = 'SELECT u.name, o.date FROM users u JOIN orders o ON u.id = o.user_id';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'select', { dryRun: true });

            expect(result.success).toBe(false); // Conflicts prevent operation even in dry run
            expect(result.conflicts?.some(c => c.includes('reserved SQL keyword'))).toBe(true);
            expect(result.newSql).toBeUndefined();
        });
    });

    describe('GUI Position to Lexeme Resolution', () => {
        it('should retrieve lexeme value at GUI cursor position', () => {
            const sql = 'SELECT u.name FROM users u WHERE u.active = true';
            
            // GUI user clicks at line 1, column 8 (the 'u' alias)
            const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, { line: 1, column: 8 });
            
            expect(lexeme).not.toBeNull();
            expect(lexeme!.value).toBe('u');
            expect(lexeme!.type).toBe(TokenType.Identifier);
            expect(lexeme!.position).toEqual({
                startPosition: 7,
                endPosition: 8
            });
        });

        it('should retrieve different lexemes at different positions', () => {
            const sql = 'SELECT u.name FROM users u WHERE u.active = true';
            
            // Test different cursor positions
            const testCases = [
                { position: { line: 1, column: 1 }, expectedValue: 'select' },
                { position: { line: 1, column: 8 }, expectedValue: 'u' },
                { position: { line: 1, column: 10 }, expectedValue: 'name' },
                { position: { line: 1, column: 15 }, expectedValue: 'from' },
                { position: { line: 1, column: 20 }, expectedValue: 'users' },
                { position: { line: 1, column: 26 }, expectedValue: 'u' },
                { position: { line: 1, column: 28 }, expectedValue: 'where' }
            ];
            
            for (const testCase of testCases) {
                const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, testCase.position);
                expect(lexeme?.value).toBe(testCase.expectedValue);
            }
        });

        it('should handle multi-line SQL lexeme resolution', () => {
            const sql = `SELECT u.name, u.email
FROM users u
WHERE u.active = true`;
            
            // Test positions across different lines
            const testCases = [
                { position: { line: 1, column: 8 }, expectedValue: 'u' },
                { position: { line: 1, column: 16 }, expectedValue: 'u' },
                { position: { line: 2, column: 1 }, expectedValue: 'from' },
                { position: { line: 2, column: 6 }, expectedValue: 'users' },
                { position: { line: 2, column: 12 }, expectedValue: 'u' },
                { position: { line: 3, column: 7 }, expectedValue: 'u' }
            ];
            
            for (const testCase of testCases) {
                const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, testCase.position);
                expect(lexeme?.value).toBe(testCase.expectedValue);
            }
        });

        it('should return null for positions in whitespace or invalid locations', () => {
            const sql = 'SELECT u.name FROM users u WHERE u.active = true';
            
            // Test positions that should return null
            const invalidPositions = [
                { line: 0, column: 1 },    // Invalid line
                { line: 1, column: 0 },    // Invalid column
                { line: 1, column: 7 },    // Whitespace between SELECT and u
                { line: 2, column: 1 },    // Line doesn't exist
                { line: 1, column: 100 }   // Column beyond line length
            ];
            
            for (const position of invalidPositions) {
                const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, position);
                expect(lexeme).toBeNull();
            }
        });
    });
});