import { describe, it, expect } from 'vitest';
import { LexemeCursor, LineColumn } from '../../src/utils/LexemeCursor';

describe('LexemeCursor Line-Column Support', () => {
    describe('lineColumnToCharOffset', () => {
        const sql = `SELECT u.name, o.date
FROM users u
JOIN orders o ON u.id = o.user_id`;

        it('should convert line-column to character offset correctly', () => {
            // Test position at 'u' in "u.name" (line 1, column 8)
            const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, { line: 1, column: 8 });
            expect(lexeme?.value).toBe('u');
        });

        it('should handle first position correctly', () => {
            // Test position at 'S' in "SELECT" (line 1, column 1)
            const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, { line: 1, column: 1 });
            expect(lexeme?.value).toBe('select');
        });

        it('should handle multiline SQL correctly', () => {
            // Test position at 'users' in "FROM users u" (line 2, column 6)
            const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, { line: 2, column: 6 });
            expect(lexeme?.value).toBe('users');
        });

        it('should handle third line correctly', () => {
            // Test position at 'o' in "orders o" (line 3, column 13)  
            const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, { line: 3, column: 13 });
            expect(lexeme?.value).toBe('o');
        });

        it('should return null for out of bounds positions', () => {
            expect(LexemeCursor.findLexemeAtLineColumn(sql, { line: 0, column: 1 })).toBeNull();
            expect(LexemeCursor.findLexemeAtLineColumn(sql, { line: 1, column: 0 })).toBeNull();
            expect(LexemeCursor.findLexemeAtLineColumn(sql, { line: 10, column: 1 })).toBeNull();
            expect(LexemeCursor.findLexemeAtLineColumn(sql, { line: 1, column: 1000 })).toBeNull();
        });

        it('should return null when position is in whitespace', () => {
            // Test position in whitespace between SELECT and u.name
            const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, { line: 1, column: 7 });
            expect(lexeme).toBeNull();
        });
    });

    describe('charOffsetToLineColumn', () => {
        const sql = `SELECT u.name
FROM users u`;

        it('should convert character offset to line-column correctly', () => {
            const position = LexemeCursor.charOffsetToLineColumn(sql, 7); // Position of 'u'
            expect(position).toEqual({ line: 1, column: 8 });
        });

        it('should handle first character correctly', () => {
            const position = LexemeCursor.charOffsetToLineColumn(sql, 0); // Position of 'S'
            expect(position).toEqual({ line: 1, column: 1 });
        });

        it('should handle newline positions correctly', () => {
            const position = LexemeCursor.charOffsetToLineColumn(sql, 13); // Position after newline
            expect(position).toEqual({ line: 2, column: 1 });
        });

        it('should return null for out of bounds offsets', () => {
            expect(LexemeCursor.charOffsetToLineColumn(sql, -1)).toBeNull();
            expect(LexemeCursor.charOffsetToLineColumn(sql, 1000)).toBeNull();
        });
    });

    describe('GUI Integration Scenarios', () => {
        it('should handle alias selection scenarios', () => {
            const sql = `WITH user_data AS (
    SELECT u.id, u.name 
    FROM users u
)
SELECT ud.name
FROM user_data ud
JOIN orders o ON ud.id = o.user_id`;

            // Test selecting 'u' in CTE query (line 2, column 12)
            const lexeme1 = LexemeCursor.findLexemeAtLineColumn(sql, { line: 2, column: 12 });
            expect(lexeme1?.value).toBe('u');

            // Test selecting 'ud' in main query (line 5, column 8)
            const lexeme2 = LexemeCursor.findLexemeAtLineColumn(sql, { line: 5, column: 8 });
            expect(lexeme2?.value).toBe('ud');

            // Test selecting 'o' in JOIN clause (line 7, column 13)
            const lexeme3 = LexemeCursor.findLexemeAtLineColumn(sql, { line: 7, column: 13 });
            expect(lexeme3?.value).toBe('o');
        });

        it('should handle complex SQL with subqueries', () => {
            const sql = `SELECT *
FROM (
    SELECT o.id, o.date
    FROM orders o
    WHERE o.status = 'active'
) AS order_list
WHERE order_list.date > '2024-01-01'`;

            // Test selecting 'o' in subquery (line 3, column 12)
            const lexeme1 = LexemeCursor.findLexemeAtLineColumn(sql, { line: 3, column: 12 });
            expect(lexeme1?.value).toBe('o');

            // Test selecting 'order_list' in main query (line 7, column 7)
            const lexeme2 = LexemeCursor.findLexemeAtLineColumn(sql, { line: 7, column: 7 });
            expect(lexeme2?.value).toBe('order_list');
        });
    });
});