import { describe, it, expect, test } from 'vitest';
import { PositionAwareParser, PositionParseResult } from '../../src/utils/PositionAwareParser';

describe('PositionAwareParser', () => {
    describe('Normal parsing scenarios', () => {
        test('should parse complete valid SQL normally', () => {
            const sql = 'SELECT id, name FROM users WHERE active = 1';
            const result = PositionAwareParser.parseToPosition(sql, sql.length);
            
            expect(result.success).toBe(true);
            expect(result.query).toBeDefined();
            expect(result.parsedTokens).toBeDefined();
        });
        
        test('should identify token before cursor', () => {
            const sql = 'SELECT name FROM users WHERE active = 1';
            const result = PositionAwareParser.parseToPosition(sql, 11); // After 'name'
            
            expect(result.tokenBeforeCursor?.value).toBe('name');
        });
        
        test('should handle cursor at various positions', () => {
            const sql = 'SELECT id, name FROM users WHERE active = 1';
            
            // Test different cursor positions
            const positions = [0, 6, 10, 15, 20, 30, sql.length];
            
            for (const pos of positions) {
                const result = PositionAwareParser.parseToPosition(sql, pos);
                expect(result).toBeDefined();
                expect(result.parsedTokens).toBeDefined();
            }
        });
    });
    
    describe('Error recovery mechanisms', () => {
        test('should recover from incomplete SELECT', () => {
            const sql = 'SELECT';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true,
                insertMissingTokens: true
            });
            
            expect(result.success).toBe(true);
            expect(result.recoveryAttempts).toBeGreaterThan(0);
        });
        
        test('should recover from incomplete FROM', () => {
            const sql = 'SELECT * FROM';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true,
                insertMissingTokens: true
            });
            
            expect(result.success).toBe(true);
            expect(result.recoveryAttempts).toBeGreaterThan(0);
        });
        
        test('should recover from incomplete WHERE', () => {
            const sql = 'SELECT * FROM users WHERE';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true,
                insertMissingTokens: true
            });
            
            expect(result.success).toBe(true);
            expect(result.recoveryAttempts).toBeGreaterThan(0);
        });
        
        test('should recover from incomplete JOIN', () => {
            const sql = 'SELECT * FROM users u LEFT JOIN';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true,
                insertMissingTokens: true
            });
            
            expect(result.success).toBe(true);
            expect(result.recoveryAttempts).toBeGreaterThan(0);
        });
        
        test('should recover from incomplete ON clause', () => {
            const sql = 'SELECT * FROM users u LEFT JOIN orders o ON';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true,
                insertMissingTokens: true
            });
            
            expect(result.success).toBe(true);
            expect(result.recoveryAttempts).toBeGreaterThan(0);
        });
        
        test('should recover from incomplete GROUP BY', () => {
            const sql = 'SELECT user_id, COUNT(*) FROM orders GROUP BY';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true,
                insertMissingTokens: true
            });
            
            expect(result.success).toBe(true);
            expect(result.recoveryAttempts).toBeGreaterThan(0);
        });
        
        test('should recover from incomplete ORDER BY', () => {
            const sql = 'SELECT * FROM users ORDER BY';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true,
                insertMissingTokens: true
            });
            
            expect(result.success).toBe(true);
            expect(result.recoveryAttempts).toBeGreaterThan(0);
        });
    });
    
    describe('Truncation recovery', () => {
        test('should handle cursor in middle of query with truncation', () => {
            const sql = 'SELECT name FROM users WHERE active = 1 ORDER BY name';
            const result = PositionAwareParser.parseToPosition(sql, 30, { // Middle of WHERE clause
                errorRecovery: true
            });
            
            expect(result).toBeDefined();
            expect(result.stoppedAtCursor).toBe(true);
        });
        
        test('should recover with minimal completion', () => {
            const sql = 'SELECT user.';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true
            });
            
            expect(result.success).toBe(true);
        });
    });
    
    describe('Completion recovery', () => {
        test('should complete dot notation', () => {
            const sql = 'SELECT u.';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true
            });
            
            expect(result.success).toBe(true);
            expect(result.recoveryAttempts).toBeGreaterThan(0);
        });
        
        test('should complete parentheses', () => {
            const sql = 'SELECT COUNT(';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true
            });
            
            expect(result.success).toBe(true);
        });
        
        test('should complete comma-separated lists', () => {
            const sql = 'SELECT name,';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true
            });
            
            expect(result.success).toBe(true);
        });
    });
    
    describe('Line/column position support', () => {
        test('should parse to line/column position', () => {
            const sql = `SELECT u.name,
       u.email
FROM users u
WHERE u.active = 1`;
            
            const result = PositionAwareParser.parseToPosition(sql, { line: 2, column: 8 }, {
                errorRecovery: true
            });
            
            expect(result).toBeDefined();
            expect(result.tokenBeforeCursor).toBeDefined();
        });
        
        test('should handle multi-line incomplete SQL', () => {
            const sql = `SELECT 
    u.name,
    u.email
FROM users u
WHERE u.`;
            
            const result = PositionAwareParser.parseToPosition(sql, { line: 5, column: 9 }, {
                errorRecovery: true
            });
            
            expect(result.success).toBe(true);
        });
    });
    
    describe('Multi-query parsing', () => {
        test('should parse current query from multi-query text', () => {
            const multiSQL = `
                SELECT 1;
                SELECT name FROM users WHERE name LIKE 'John%';
                SELECT 2;
            `.trim();
            
            const result = PositionAwareParser.parseCurrentQuery(multiSQL, 50, { // Position in second query
                errorRecovery: true
            });
            
            expect(result.success).toBe(true);
            expect(result.query).toBeDefined();
        });
        
        test('should handle incomplete query in multi-query context', () => {
            const multiSQL = `
                SELECT 1;
                SELECT name FROM users WHERE;
                SELECT 2;
            `.trim();
            
            const result = PositionAwareParser.parseCurrentQuery(multiSQL, 45, {
                errorRecovery: true,
                insertMissingTokens: true
            });
            
            expect(result.success).toBe(true);
        });
        
        test('should handle cursor at query boundary', () => {
            const multiSQL = 'SELECT 1; SELECT 2;';
            const result = PositionAwareParser.parseCurrentQuery(multiSQL, 9, { // At semicolon
                errorRecovery: true
            });
            
            expect(result).toBeDefined();
        });
    });
    
    describe('Complex SQL scenarios', () => {
        test('should handle CTEs with incomplete syntax', () => {
            const sql = `
                WITH user_orders AS (
                    SELECT user_id, COUNT(*) FROM orders GROUP BY user_id
                )
                SELECT * FROM user_orders WHERE
            `.trim();
            
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true,
                insertMissingTokens: true
            });
            
            expect(result.success).toBe(true);
        });
        
        test('should handle subqueries with errors', () => {
            const sql = `
                SELECT * FROM (
                    SELECT user_id FROM orders WHERE
                ) sub
            `.trim();
            
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true
            });
            
            expect(result.success).toBe(true);
        });
        
        test('should handle complex JOINs with incomplete ON clauses', () => {
            const sql = `
                SELECT * FROM users u
                LEFT OUTER JOIN orders o ON u.id =
                WHERE u.active = 1
            `.trim();
            
            const result = PositionAwareParser.parseToPosition(sql, sql.indexOf('=') + 1, {
                errorRecovery: true
            });
            
            expect(result.success).toBe(true);
        });
    });
    
    describe('Recovery limits and configuration', () => {
        test('should respect maximum recovery attempts', () => {
            const sql = 'INVALID SQL SYNTAX HERE';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true,
                maxRecoveryAttempts: 2
            });
            
            expect(result.recoveryAttempts).toBeLessThanOrEqual(2);
        });
        
        test('should disable token insertion when requested', () => {
            const sql = 'SELECT FROM'; // Missing column list
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true,
                insertMissingTokens: false
            });
            
            // Should still attempt recovery but without token insertion
            expect(result).toBeDefined();
        });
    });
    
    describe('Error handling and edge cases', () => {
        test('should handle empty string', () => {
            const result = PositionAwareParser.parseToPosition('', 0);
            
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
        
        test('should handle invalid cursor position', () => {
            const sql = 'SELECT * FROM users';
            const result = PositionAwareParser.parseToPosition(sql, 1000);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid cursor position');
        });
        
        test('should handle invalid line/column position', () => {
            const sql = 'SELECT * FROM users';
            const result = PositionAwareParser.parseToPosition(sql, { line: 100, column: 1 });
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid cursor position');
        });
        
        test('should provide partial AST even on failure', () => {
            const sql = 'COMPLETELY INVALID SQL';
            const result = PositionAwareParser.parseToPosition(sql, sql.length, {
                errorRecovery: true
            });
            
            // Even if main parsing fails, should attempt to provide some context
            expect(result).toBeDefined();
        });
        
        test('should handle cursor at start of string', () => {
            const sql = 'SELECT * FROM users';
            const result = PositionAwareParser.parseToPosition(sql, 0);
            
            expect(result).toBeDefined();
            expect(result.tokenBeforeCursor).toBeUndefined();
        });
    });
    
    describe('Token information accuracy', () => {
        test('should provide accurate token positions', () => {
            const sql = 'SELECT name, email FROM users WHERE active = 1';
            const result = PositionAwareParser.parseToPosition(sql, 12); // Position at 'email'
            
            expect(result.parsedTokens).toBeDefined();
            expect(result.tokenBeforeCursor?.value).toBe(',');
        });
        
        test('should handle tokens with comments', () => {
            const sql = 'SELECT /* comment */ name FROM users';
            const result = PositionAwareParser.parseToPosition(sql, 25); // After comment
            
            expect(result.parsedTokens).toBeDefined();
            expect(result.tokenBeforeCursor).toBeDefined();
        });
    });
});