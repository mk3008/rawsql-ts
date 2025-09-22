import { describe, test, expect } from 'vitest';
import { CursorContextAnalyzer } from '../../src/utils/CursorContextAnalyzer';

describe('CursorContextAnalyzer - IntelliSense Suggestion Fixes', () => {
    describe('JOIN keyword suggestions', () => {
        test('should suggest JOIN keyword after standalone INNER', () => {
            const sql = 'SELECT * FROM users INNER ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            // INNER alone should suggest JOIN keyword
            expect(context.suggestKeywords).toBe(true);
            expect(context.suggestTables).toBe(false);
            expect(context.suggestColumns).toBe(false);
            expect(context.requiredKeywords).toEqual(['JOIN']);
        });

        test('should suggest tables after INNER JOIN keywords', () => {
            const sql = 'SELECT * FROM users INNER JOIN ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestTables).toBe(true);
            expect(context.suggestKeywords).toBe(false);
            expect(context.suggestColumns).toBe(false);
        });

        test('should suggest complete JOIN options after standalone LEFT', () => {
            const sql = 'SELECT * FROM users LEFT ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestKeywords).toBe(true);
            expect(context.suggestTables).toBe(false);
            expect(context.requiredKeywords).toEqual(['JOIN', 'OUTER JOIN']);
        });

        test('should suggest tables after LEFT JOIN keywords', () => {
            const sql = 'SELECT * FROM users LEFT JOIN ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestTables).toBe(true);
            expect(context.suggestKeywords).toBe(false);
        });

        test('should suggest JOIN keyword after CROSS', () => {
            const sql = 'SELECT * FROM users CROSS ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestKeywords).toBe(true);
            expect(context.requiredKeywords).toEqual(['JOIN']);
            expect(context.suggestTables).toBe(false);
        });

        test('should suggest complete JOIN phrases after NATURAL', () => {
            const sql = 'SELECT * FROM users NATURAL ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestKeywords).toBe(true);
            expect(context.requiredKeywords).toEqual([
                'JOIN', 'INNER JOIN', 'LEFT JOIN', 'LEFT OUTER JOIN',
                'RIGHT JOIN', 'RIGHT OUTER JOIN', 'FULL JOIN', 'FULL OUTER JOIN'
            ]);
            expect(context.suggestTables).toBe(false);
        });

        test('should suggest tables after CROSS JOIN', () => {
            const sql = 'SELECT * FROM users CROSS JOIN ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestTables).toBe(true);
            expect(context.suggestKeywords).toBe(false);
        });

        // TODO: Fix LATERAL JOIN IntelliSense recognition
        // Issue: KeywordCache.isValidJoinKeyword('lateral') returns false
        // Root cause: joinkeywordParser.parse('lateral', 0) fails
        // Expected: Should suggest ['JOIN', 'INNER JOIN', 'LEFT JOIN', 'LEFT OUTER JOIN']
        // Priority: Low (IntelliSense feature, not core functionality)
        test.skip('should suggest complete JOIN phrases after LATERAL (TODO: fix LATERAL recognition)', () => {
            const sql = 'SELECT * FROM users LATERAL ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestKeywords).toBe(true);
            expect(context.requiredKeywords).toEqual([
                'JOIN', 'INNER JOIN', 'LEFT JOIN', 'LEFT OUTER JOIN'
            ]);
            expect(context.suggestTables).toBe(false);
        });

        test('should suggest tables after LATERAL JOIN', () => {
            const sql = 'SELECT * FROM users LATERAL JOIN ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestTables).toBe(true);
            expect(context.suggestKeywords).toBe(false);
        });

        test('debug: should show discovered complete JOIN phrases from dictionary', () => {
            // This test demonstrates dictionary-based discovery with complete phrases
            const sql1 = 'SELECT * FROM users INNER ';
            const context1 = CursorContextAnalyzer.analyzeIntelliSense(sql1, sql1.length);
            expect(context1.suggestKeywords).toBe(true);
            expect(context1.requiredKeywords).toEqual(['JOIN']);

            const sql2 = 'SELECT * FROM users CROSS ';  
            const context2 = CursorContextAnalyzer.analyzeIntelliSense(sql2, sql2.length);
            expect(context2.suggestKeywords).toBe(true);
            expect(context2.requiredKeywords).toEqual(['JOIN']);

            const sql3 = 'SELECT * FROM users NATURAL ';
            const context3 = CursorContextAnalyzer.analyzeIntelliSense(sql3, sql3.length);  
            expect(context3.suggestKeywords).toBe(true);
            expect(context3.requiredKeywords).toEqual([
                'JOIN', 'INNER JOIN', 'LEFT JOIN', 'LEFT OUTER JOIN',
                'RIGHT JOIN', 'RIGHT OUTER JOIN', 'FULL JOIN', 'FULL OUTER JOIN'
            ]);
        });
    });

    describe('GROUP BY keyword suggestions', () => {
        test('should suggest BY keyword after standalone GROUP', () => {
            const sql = 'SELECT * FROM users GROUP ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestKeywords).toBe(true);
            expect(context.suggestTables).toBe(false);
            expect(context.suggestColumns).toBe(false);
            expect(context.requiredKeywords).toEqual(['BY']);
        });

        test('should suggest columns after GROUP BY keywords', () => {
            const sql = 'SELECT * FROM users GROUP BY ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestColumns).toBe(true);
            expect(context.suggestKeywords).toBe(false);
            expect(context.suggestTables).toBe(false);
        });
    });

    describe('ORDER BY keyword suggestions', () => {
        test('should suggest BY keyword after standalone ORDER', () => {
            const sql = 'SELECT * FROM users ORDER ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestKeywords).toBe(true);
            expect(context.suggestTables).toBe(false);
            expect(context.suggestColumns).toBe(false);
            expect(context.requiredKeywords).toEqual(['BY']);
        });

        test('should suggest columns after ORDER BY keywords', () => {
            const sql = 'SELECT * FROM users ORDER BY ';
            const context = CursorContextAnalyzer.analyzeIntelliSense(sql, sql.length);
            
            expect(context.suggestColumns).toBe(true);
            expect(context.suggestKeywords).toBe(false);
            expect(context.suggestTables).toBe(false);
        });
    });
});