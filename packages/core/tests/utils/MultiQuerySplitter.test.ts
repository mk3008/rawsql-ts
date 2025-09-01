import { describe, it, expect, test } from 'vitest';
import { MultiQuerySplitter, MultiQueryUtils, QueryInfo } from '../../src/utils/MultiQuerySplitter';

describe('MultiQuerySplitter', () => {
    describe('Basic query splitting', () => {
        test('should split simple queries separated by semicolons', () => {
            const sql = 'SELECT 1; SELECT 2; SELECT 3;';
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(3);
            expect(result.queries[0].sql).toBe('SELECT 1');
            expect(result.queries[1].sql).toBe('SELECT 2');
            expect(result.queries[2].sql).toBe('SELECT 3');
        });
        
        test('should handle queries without trailing semicolon', () => {
            const sql = 'SELECT 1; SELECT 2';
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(2);
            expect(result.queries[1].sql).toBe('SELECT 2');
        });
        
        test('should handle single query without semicolon', () => {
            const sql = 'SELECT * FROM users WHERE active = 1';
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(1);
            expect(result.queries[0].sql).toBe(sql);
        });
    });
    
    describe('String literal handling', () => {
        test('should ignore semicolons inside single quotes', () => {
            const sql = "SELECT 'hello;world'; SELECT 'another;test';";
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(2);
            expect(result.queries[0].sql).toBe("SELECT 'hello;world'");
            expect(result.queries[1].sql).toBe("SELECT 'another;test'");
        });
        
        test('should ignore semicolons inside double quotes', () => {
            const sql = 'SELECT "hello;world"; SELECT "another;test";';
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(2);
            expect(result.queries[0].sql).toBe('SELECT "hello;world"');
            expect(result.queries[1].sql).toBe('SELECT "another;test"');
        });
        
        test('should handle escaped quotes in strings', () => {
            const sql = "SELECT 'it''s a test; with semicolon'; SELECT 'another';";
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(2);
            expect(result.queries[0].sql).toBe("SELECT 'it''s a test; with semicolon'");
        });
        
        test('should handle mixed quote types', () => {
            const sql = `SELECT 'single;quote' AS col1, "double;quote" AS col2; SELECT 3;`;
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(2);
            expect(result.queries[0].sql).toBe(`SELECT 'single;quote' AS col1, "double;quote" AS col2`);
        });
    });
    
    describe('Comment handling', () => {
        test('should ignore semicolons in line comments', () => {
            const sql = `
                SELECT 1; -- This is a comment; with semicolon
                SELECT 2; -- Another comment;
            `.trim();
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(2);
            expect(result.queries[0].sql).toContain('SELECT 1');
            expect(result.queries[1].sql).toContain('SELECT 2');
        });
        
        test('should ignore semicolons in block comments', () => {
            const sql = `
                SELECT 1 /* comment; with semicolon */;
                SELECT 2 /* another; comment; here */;
            `.trim();
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(2);
            expect(result.queries[0].sql).toContain('SELECT 1');
            expect(result.queries[1].sql).toContain('SELECT 2');
        });
        
        test('should handle multi-line block comments', () => {
            const sql = `
                SELECT 1 /* 
                   multi-line comment;
                   with semicolon;
                */;
                SELECT 2;
            `.trim();
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(2);
        });
    });
    
    describe('Empty query handling', () => {
        test('should identify empty queries', () => {
            const sql = 'SELECT 1;; SELECT 2;';
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(3);
            expect(result.queries[0].isEmpty).toBe(false);
            expect(result.queries[1].isEmpty).toBe(true); // Empty query between semicolons
            expect(result.queries[2].isEmpty).toBe(false);
        });
        
        test('should identify comment-only queries as empty', () => {
            const sql = 'SELECT 1;; -- Just a comment;';
            const result = MultiQuerySplitter.split(sql);
            
            const commentOnlyQuery = result.queries.find(q => q.sql.trim().startsWith('--'));
            expect(commentOnlyQuery?.isEmpty).toBe(true);
        });
        
        test('should handle whitespace-only queries', () => {
            const sql = 'SELECT 1;   \n  \t  ; SELECT 2;';
            const result = MultiQuerySplitter.split(sql);
            
            const whitespaceQuery = result.queries.find(q => q.sql.trim() === '');
            expect(whitespaceQuery?.isEmpty).toBe(true);
        });
    });
    
    describe('Position information', () => {
        test('should provide accurate start and end positions', () => {
            const sql = 'SELECT 1; SELECT 2; SELECT 3;';
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries[0]).toMatchObject({
                start: 0,
                end: 8 // Position of first semicolon
            });
            
            expect(result.queries[1]).toMatchObject({
                start: expect.any(Number),
                end: expect.any(Number)
            });
            
            // Verify the extracted SQL matches the positions
            const firstQuery = sql.substring(result.queries[0].start, result.queries[0].end);
            expect(firstQuery.trim()).toBe('SELECT 1');
        });
        
        test('should provide line number information', () => {
            const sql = `SELECT 1;
SELECT 2;
SELECT 3;`;
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries[0]).toMatchObject({
                startLine: 1,
                endLine: 1
            });
            
            expect(result.queries[1]).toMatchObject({
                startLine: 2,
                endLine: 2
            });
            
            expect(result.queries[2]).toMatchObject({
                startLine: 3,
                endLine: 3
            });
        });
        
        test('should handle multi-line queries', () => {
            const sql = `SELECT * 
FROM users 
WHERE active = 1;
SELECT 2;`;
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries[0]).toMatchObject({
                startLine: 1,
                endLine: expect.any(Number) // Should span multiple lines
            });
        });
    });
    
    describe('Query collection methods', () => {
        test('should find active query by character position', () => {
            const sql = 'SELECT 1; SELECT name FROM users; SELECT 3;';
            const result = MultiQuerySplitter.split(sql);
            
            const activeQuery = result.getActive(15); // Position in second query
            expect(activeQuery?.sql).toContain('SELECT name FROM users');
        });
        
        test('should find active query by line/column position', () => {
            const sql = `SELECT 1;
SELECT name FROM users;
SELECT 3;`;
            const result = MultiQuerySplitter.split(sql);
            
            const activeQuery = result.getActive({ line: 2, column: 5 });
            expect(activeQuery?.sql).toContain('SELECT name FROM users');
        });
        
        test('should return undefined for position outside all queries', () => {
            const sql = 'SELECT 1; SELECT 2;';
            const result = MultiQuerySplitter.split(sql);
            
            const activeQuery = result.getActive(1000);
            expect(activeQuery).toBeUndefined();
        });
        
        test('should get query by index', () => {
            const sql = 'SELECT 1; SELECT 2; SELECT 3;';
            const result = MultiQuerySplitter.split(sql);
            
            const secondQuery = result.getQuery(1);
            expect(secondQuery?.sql).toBe('SELECT 2');
            
            const invalidQuery = result.getQuery(10);
            expect(invalidQuery).toBeUndefined();
        });
        
        test('should filter non-empty queries', () => {
            const sql = 'SELECT 1;; -- comment only; SELECT 2;   ;';
            const result = MultiQuerySplitter.split(sql);
            
            const nonEmpty = result.getNonEmpty();
            expect(nonEmpty).toHaveLength(1); // Should exclude empty and comment-only queries
            expect(nonEmpty[0].sql).toBe('SELECT 1');
            // Note: "-- comment only; SELECT 2;" is a line comment, so SELECT 2 is commented out
        });
    });
    
    describe('Complex SQL scenarios', () => {
        test('should handle CTEs across multiple queries', () => {
            const sql = `
                WITH user_data AS (SELECT id, name FROM users)
                SELECT * FROM user_data;
                
                SELECT COUNT(*) FROM orders;
            `.trim();
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(2);
            expect(result.queries[0].sql).toContain('WITH user_data');
            expect(result.queries[1].sql).toContain('SELECT COUNT(*)');
        });
        
        test('should handle subqueries with semicolons in strings', () => {
            const sql = `
                SELECT * FROM (
                    SELECT 'test;value' AS col
                ) sub;
                SELECT 2;
            `.trim();
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(2);
            expect(result.queries[0].sql).toContain('SELECT * FROM (');
        });
        
        test('should handle mixed comment styles', () => {
            const sql = `
                -- First query comment
                SELECT 1 /* inline comment; with semicolon */;
                
                /* 
                 * Block comment for second query;
                 * with multiple lines;
                 */
                SELECT 2; -- End comment
            `.trim();
            const result = MultiQuerySplitter.split(sql);
            
            expect(result.queries).toHaveLength(2);
        });
    });
    
    describe('Edge cases', () => {
        test('should handle empty string', () => {
            const result = MultiQuerySplitter.split('');
            expect(result.queries).toHaveLength(0);
        });
        
        test('should handle string with only whitespace', () => {
            const result = MultiQuerySplitter.split('   \n  \t  ');
            expect(result.queries).toHaveLength(0);
        });
        
        test('should handle string with only semicolons', () => {
            const result = MultiQuerySplitter.split(';;;');
            expect(result.queries).toHaveLength(3);
            result.queries.forEach(q => expect(q.isEmpty).toBe(true));
        });
        
        test('should handle unclosed string literals gracefully', () => {
            const sql = "SELECT 'unclosed string; SELECT 2;";
            const result = MultiQuerySplitter.split(sql);
            
            // Should handle gracefully, even if not perfectly parsed
            expect(result.queries).toBeDefined();
        });
        
        test('should handle unclosed block comments gracefully', () => {
            const sql = "SELECT 1 /* unclosed comment; SELECT 2;";
            const result = MultiQuerySplitter.split(sql);
            
            // Should handle gracefully
            expect(result.queries).toBeDefined();
        });
    });
});

describe('MultiQueryUtils', () => {
    describe('Context extraction', () => {
        test('should get context at cursor position', () => {
            const sql = 'SELECT 1; SELECT name FROM users WHERE active = 1; SELECT 3;';
            const context = MultiQueryUtils.getContextAt(sql, 25); // In second query
            
            expect(context).toBeDefined();
            expect(context?.query.sql).toContain('SELECT name FROM users');
            expect(context?.relativePosition).toBeGreaterThan(0);
        });
        
        test('should handle line/column position', () => {
            const sql = `SELECT 1;
SELECT name FROM users WHERE active = 1;
SELECT 3;`;
            const context = MultiQueryUtils.getContextAt(sql, { line: 2, column: 10 });
            
            expect(context?.query.sql).toContain('SELECT name FROM users');
        });
        
        test('should return undefined for invalid position', () => {
            const sql = 'SELECT 1; SELECT 2;';
            const context = MultiQueryUtils.getContextAt(sql, 1000);
            
            expect(context).toBeUndefined();
        });
    });
    
    describe('Query extraction', () => {
        test('should extract all non-empty queries', () => {
            const sql = 'SELECT 1;; SELECT 2; -- comment; SELECT 3;';
            const queries = MultiQueryUtils.extractQueries(sql);
            
            expect(queries).toEqual(['SELECT 1', 'SELECT 2; -- comment; SELECT 3;']);
            // Note: The line comment "-- comment; SELECT 3;" is part of the second query as it extends to end of line
        });
        
        test('should handle empty input', () => {
            const queries = MultiQueryUtils.extractQueries('');
            expect(queries).toEqual([]);
        });
        
        test('should extract complex queries', () => {
            const sql = `
                WITH user_data AS (SELECT id, name FROM users)
                SELECT * FROM user_data WHERE name LIKE 'J%';
                
                SELECT COUNT(*) FROM orders WHERE status = 'completed';
            `.trim();
            const queries = MultiQueryUtils.extractQueries(sql);
            
            expect(queries).toHaveLength(2);
            expect(queries[0]).toContain('WITH user_data');
            expect(queries[1]).toContain('SELECT COUNT(*)');
        });
    });
});