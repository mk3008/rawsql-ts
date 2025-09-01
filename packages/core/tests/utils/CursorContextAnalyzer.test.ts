import { describe, it, expect, test } from 'vitest';
import { CursorContextAnalyzer, IntelliSenseContext } from '../../src/utils/CursorContextAnalyzer';

describe('CursorContextAnalyzer', () => {
    describe('Basic IntelliSense Context Detection', () => {
        test('should suggest columns after SELECT keyword', () => {
            const sql = 'SELECT name, email FROM users';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, 7); // Position after 'SELECT '
            
            expect(context.suggestColumns).toBe(true);
            expect(context.suggestTables).toBe(false);
            expect(context.suggestKeywords).toBe(false);
        });
        
        test('should suggest tables after FROM keyword', () => {
            const sql = 'SELECT * FROM users WHERE active = 1';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, 14); // Position after 'FROM '
            
            expect(context.suggestTables).toBe(true);
            expect(context.suggestColumns).toBe(false);
            expect(context.suggestKeywords).toBe(false);
        });
        
        test('should suggest columns after WHERE keyword', () => {
            const sql = 'SELECT * FROM users WHERE active = 1';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, 26); // Position after 'WHERE '
            
            expect(context.suggestColumns).toBe(true);
            expect(context.suggestTables).toBe(false);
            expect(context.suggestKeywords).toBe(false);
        });
        
        test('should suggest tables after JOIN keyword', () => {
            const sql = 'SELECT * FROM users u LEFT JOIN orders o ON u.id = o.user_id';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, 37); // Position after 'JOIN '
            
            expect(context.suggestTables).toBe(true);
            expect(context.suggestColumns).toBe(false);
            expect(context.suggestKeywords).toBe(false);
        });
    });
    
    describe('Dot Completion Detection', () => {
        test('should suggest columns after dot with table scope', () => {
            const sql = 'SELECT u.name FROM users u WHERE u.';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestColumns).toBe(true);
            expect(context.suggestTables).toBe(false);
            expect(context.suggestKeywords).toBe(false);
            expect(context.tableScope).toBe('u');
        });
        
        test('should identify table scope for dot completion', () => {
            const sql = 'SELECT user_table.column_name FROM users user_table WHERE user_table.';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestColumns).toBe(true);
            expect(context.tableScope).toBe('user_table');
        });
        
        test('should handle qualified name dot completion', () => {
            const sql = 'SELECT schema.table.';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestColumns).toBe(true);
            expect(context.tableScope).toBe('table');
        });
    });
    
    describe('Keyword Suggestions', () => {
        test('should suggest JOIN keyword after INNER', () => {
            const sql = 'SELECT * FROM users INNER ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestKeywords).toBe(true);
            expect(context.suggestTables).toBe(false);
            expect(context.suggestColumns).toBe(false);
            expect(context.requiredKeywords).toEqual(['JOIN']);
        });
        
        test('should suggest complete JOIN options after LEFT for better UX', () => {
            const sql = 'SELECT * FROM users LEFT ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestKeywords).toBe(true);
            expect(context.requiredKeywords).toEqual(['JOIN', 'OUTER JOIN']);
        });
        
        test('should suggest BY keyword after GROUP', () => {
            const sql = 'SELECT * FROM users GROUP ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestKeywords).toBe(true);
            expect(context.requiredKeywords).toEqual(['BY']);
        });
    });
    
    describe('Complex scenarios', () => {
        test('should handle dot completion in SELECT clause', () => {
            const sql = `
                WITH user_orders AS (
                    SELECT user_id, count(*) as order_count FROM orders GROUP BY user_id
                )
                SELECT uo.
            `.trim();
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestColumns).toBe(true);
            expect(context.tableScope).toBe('uo');
        });
        
        test('should handle subquery dot completion', () => {
            const sql = `
                SELECT * FROM (
                    SELECT user_id FROM orders o WHERE o.
                ) sub
            `.trim();
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.lastIndexOf('.') + 1);
            
            expect(context.suggestColumns).toBe(true);
            expect(context.tableScope).toBe('o');
                    });
    });
    
    describe('Edge cases and error handling', () => {
        test('should handle incomplete SQL gracefully', () => {
            const sql = 'SELECT * FROM';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestTables).toBe(true);
        });
        
        test('should handle SQL with syntax errors', () => {
            const sql = 'SELECT * FORM users WHERE'; // typo: FORM instead of FROM
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            // Should still provide some context even with errors
            expect(context).toBeDefined();
        });
        
        test('should handle empty string', () => {
            const context = CursorContextAnalyzer.analyzeIntelliSense('', 0);
            
            expect(context.suggestColumns).toBe(false);
            expect(context.suggestTables).toBe(false);
        });
        
        test('should handle cursor at end of string', () => {
            const sql = 'SELECT * FROM users';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context).toBeDefined();
        });
    });
    
    describe('Line/Column position analysis', () => {
        test('should analyze context at line/column position', () => {
            const sql = `SELECT u.name 
FROM users u 
WHERE u.active = 1`;
            
            const context = CursorContextAnalyzer.analyzeIntelliSenseAt(sql, { line: 3, column: 7 }); // Position after 'WHERE '
            
            expect(context.suggestColumns).toBe(true);
        });
        
        test('should handle multi-line SQL with dots', () => {
            const sql = `SELECT 
    u.name,
    u.email
FROM users u
WHERE u.`;
            
            const context = CursorContextAnalyzer.analyzeIntelliSenseAt(sql, { line: 5, column: 9 });
            
            expect(context.suggestColumns).toBe(true);
            expect(context.tableScope).toBe('u');
        });
    });
    
    describe('Token information', () => {
        test('should provide token information', () => {
            const sql = 'SELECT name FROM users WHERE active';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, 35); // End of 'active'
            
            expect(context.currentToken).toBeDefined();
            expect(context.previousToken).toBeDefined();
        });
        
        test('should handle parentheses in complex expressions', () => {
            const sql = 'SELECT * FROM users WHERE (status IN (1, 2) AND active = 1)';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, 44); // Inside IN parentheses
            
            // Should still provide appropriate suggestions regardless of parentheses nesting
            expect(context).toBeDefined();
        });
    });
    
    describe('Default suggestions', () => {
        test('should suggest keywords as fallback', () => {
            const sql = 'SELECT * FROM users WHERE name = ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            // Should suggest keywords when no specific context matches
            expect(context.suggestKeywords).toBe(true);
            expect(context.suggestTables).toBe(false);
            expect(context.suggestColumns).toBe(false);
        });
    });
});