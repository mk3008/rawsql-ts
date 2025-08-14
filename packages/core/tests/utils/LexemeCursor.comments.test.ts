import { describe, it, expect } from 'vitest';
import { LexemeCursor } from '../../src/utils/LexemeCursor';
import { TokenType } from '../../src/models/Lexeme';

describe('LexemeCursor - Comments and Whitespace Position Detection', () => {
    describe('findLexemeAtPosition with comments', () => {
        it('should find lexeme position correctly with prefix line comment', () => {
            // Arrange
            const sql = '-- This is a comment\nSELECT id FROM users';
            const cursorPosition = 21; // Position at 'S' in SELECT (after comment and newline)
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('select');
            expect(lexeme!.type).toBe(TokenType.Command);
            expect(lexeme!.position!.startPosition).toBe(21);
            expect(lexeme!.position!.endPosition).toBe(27);
        });

        it('should find lexeme position correctly with prefix block comment', () => {
            // Arrange
            const sql = '/* This is a\n   block comment */\nSELECT id FROM users';
            const cursorPosition = 33; // Position at 'S' in SELECT (after comment and newline)
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('select');
            expect(lexeme!.type).toBe(TokenType.Command);
            expect(lexeme!.position!.startPosition).toBe(33);
            expect(lexeme!.position!.endPosition).toBe(39);
        });

        it('should find lexeme position correctly with mixed whitespace and comments', () => {
            // Arrange
            const sql = `   -- Comment 1
            /* Block comment */   
                SELECT    id    FROM    users    -- End comment`;
            const expectedSelectPos = sql.indexOf('SELECT');
            const cursorPosition = expectedSelectPos + 2; // Position at 'L' in SELECT
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('select');
            expect(lexeme!.type).toBe(TokenType.Command);
            expect(lexeme!.position!.startPosition).toBe(expectedSelectPos);
            expect(lexeme!.position!.endPosition).toBe(expectedSelectPos + 6);
        });

        it('should handle cursor position inside comment (should return null)', () => {
            // Arrange
            const sql = '-- This is a comment\nSELECT id FROM users';
            const cursorPosition = 10; // Position inside the comment
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeNull();
        });

        it('should handle cursor position inside block comment (should return null)', () => {
            // Arrange
            const sql = '/* This is a block comment */\nSELECT id FROM users';
            const cursorPosition = 15; // Position inside the block comment
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeNull();
        });

        it('should find correct lexeme position with multiple spaces and tabs', () => {
            // Arrange
            const sql = 'SELECT\t\t   id   \t  FROM\t   users';
            const expectedIdPos = sql.indexOf('id');
            const cursorPosition = expectedIdPos + 1; // Position at 'd' in 'id'
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('id');
            expect(lexeme!.type).toBe(TokenType.Identifier);
            expect(lexeme!.position!.startPosition).toBe(expectedIdPos);
            expect(lexeme!.position!.endPosition).toBe(expectedIdPos + 2);
        });

        it('should handle complex SQL with inline comments correctly', () => {
            // Arrange
            const sql = `SELECT 
                t1.id, -- Primary key
                t1.name /* User name */,
                t2.email -- Contact info
            FROM users t1 -- Main table
            JOIN emails t2 ON t1.id = t2.user_id`;
            
            const emailPos = sql.indexOf('email');
            const cursorPosition = emailPos + 2; // Position at 'a' in 'email'
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('email');
            expect(lexeme!.type).toBe(TokenType.Identifier);
            expect(lexeme!.position!.startPosition).toBe(emailPos);
            expect(lexeme!.position!.endPosition).toBe(emailPos + 5);
        });
    });

    describe('getAllLexemesWithPosition with comments', () => {
        it('should return correct positions for all lexemes with prefix comments', () => {
            // Arrange
            const sql = '-- Comment\nSELECT id FROM users';
            
            // Act
            const lexemes = LexemeCursor.getAllLexemesWithPosition(sql);
            
            // Assert
            expect(lexemes).toHaveLength(4);
            
            expect(lexemes[0].value).toBe('select');
            expect(lexemes[0].position!.startPosition).toBe(11);
            expect(lexemes[0].position!.endPosition).toBe(17);
            
            expect(lexemes[1].value).toBe('id');
            expect(lexemes[1].position!.startPosition).toBe(18);
            expect(lexemes[1].position!.endPosition).toBe(20);
        });

        it('should handle empty lines and multiple comment types', () => {
            // Arrange
            const sql = `
            -- Line comment 1
            
            /* Block comment 
               spanning multiple lines */
               
            SELECT 
                id, 
                name 
            FROM users`;
            
            // Act
            const lexemes = LexemeCursor.getAllLexemesWithPosition(sql);
            
            // Assert
            expect(lexemes.length).toBeGreaterThan(0);
            expect(lexemes[0].value).toBe('select');
            
            // Verify that positions are correctly calculated
            const selectPos = sql.indexOf('SELECT');
            expect(lexemes[0].position!.startPosition).toBe(selectPos);
        });

        it('should handle SQL with only comments (should return empty array)', () => {
            // Arrange
            const sql = '-- Just a comment\n/* Another comment */';
            
            // Act
            const lexemes = LexemeCursor.getAllLexemesWithPosition(sql);
            
            // Assert
            expect(lexemes).toHaveLength(0);
        });

        it('should correctly handle mixed indentation and comments', () => {
            // Arrange
            const sql = `    -- Indented comment
\t\tSELECT\t/* inline comment */\tid
            FROM/* another comment */users`;
            
            // Act
            const lexemes = LexemeCursor.getAllLexemesWithPosition(sql);
            
            // Assert
            expect(lexemes.length).toBeGreaterThan(0);
            
            // Find SELECT token
            const selectLexeme = lexemes.find(l => l.value === 'select');
            expect(selectLexeme).toBeDefined();
            
            const selectPos = sql.indexOf('SELECT');
            expect(selectLexeme!.position!.startPosition).toBe(selectPos);
        });
    });

    describe('edge cases with special characters and comments', () => {
        it('should handle SQL with Unicode characters in comments', () => {
            // Arrange
            const sql = '-- コメント (Japanese comment)\nSELECT id FROM users';
            const cursorPosition = sql.indexOf('SELECT') + 2;
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('select');
        });

        it('should handle nested-like comment structures', () => {
            // Arrange
            const sql = '/* Outer comment /* not nested in SQL */ still outer */ SELECT id';
            const cursorPosition = sql.indexOf('SELECT') + 2;
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('select');
        });

        it('should handle comment-like strings inside string literals', () => {
            // Arrange
            const sql = "SELECT 'This is not -- a comment' AS text FROM users";
            const cursorPosition = sql.indexOf('text');
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('text');
        });
    });
});