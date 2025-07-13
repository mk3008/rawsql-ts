import { describe, it, expect } from 'vitest';
import { LexemeCursor } from '../../src/utils/LexemeCursor';
import { TokenType } from '../../src/models/Lexeme';

describe('LexemeCursor', () => {
    describe('findLexemeAtPosition', () => {
        it('should find lexeme at cursor position in simple SQL', () => {
            // Arrange
            const sql = 'SELECT id FROM users';
            const cursorPosition = 7; // Position at 'id'
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('id');
            expect(lexeme!.type).toBe(TokenType.Identifier);
            expect(lexeme!.position).toBeDefined();
            expect(lexeme!.position!.startPosition).toBe(7);
            expect(lexeme!.position!.endPosition).toBe(9);
        });

        it('should find lexeme at start position', () => {
            // Arrange
            const sql = 'SELECT id FROM users';
            const cursorPosition = 0; // Position at 'S' in SELECT
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('select');
            expect(lexeme!.type).toBe(TokenType.Command);
            expect(lexeme!.position!.startPosition).toBe(0);
            expect(lexeme!.position!.endPosition).toBe(6);
        });

        it('should find lexeme at end position', () => {
            // Arrange
            const sql = 'SELECT id FROM users';
            const cursorPosition = 18; // Position at 's' in users
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('users');
            expect(lexeme!.type).toBe(TokenType.Identifier);
            expect(lexeme!.position!.startPosition).toBe(15);
            expect(lexeme!.position!.endPosition).toBe(20);
        });

        it('should return null for position in whitespace', () => {
            // Arrange
            const sql = 'SELECT id FROM users';
            const cursorPosition = 6; // Position in space after SELECT
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeNull();
        });

        it('should return null for position out of bounds', () => {
            // Arrange
            const sql = 'SELECT id';
            const cursorPosition = 100; // Position beyond string length
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeNull();
        });

        it('should find operator lexeme', () => {
            // Arrange
            const sql = 'SELECT * FROM users WHERE id = 1';
            const cursorPosition = 29; // Position at '='
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('=');
            expect(lexeme!.type).toBe(TokenType.Operator);
            expect(lexeme!.position!.startPosition).toBe(29);
            expect(lexeme!.position!.endPosition).toBe(30);
        });

        it('should find function lexeme', () => {
            // Arrange
            const sql = 'SELECT COUNT(*) FROM users';
            const cursorPosition = 8; // Position at 'O' in COUNT
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe('count');
            expect(lexeme!.type).toBe(TokenType.Function);
            expect(lexeme!.position!.startPosition).toBe(7);
            expect(lexeme!.position!.endPosition).toBe(12);
        });

        it('should find literal lexeme', () => {
            // Arrange
            const sql = "SELECT * FROM users WHERE name = 'John'";
            const cursorPosition = 36; // Position at 'h' in 'John'
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, cursorPosition);
            
            // Assert
            expect(lexeme).toBeDefined();
            expect(lexeme!.value).toBe("'John'");
            expect(lexeme!.type).toBe(TokenType.Literal);
            expect(lexeme!.position!.startPosition).toBe(33);
            expect(lexeme!.position!.endPosition).toBe(39);
        });
    });

    describe('getAllLexemesWithPosition', () => {
        it('should return all lexemes with position information', () => {
            // Arrange
            const sql = 'SELECT id FROM users';
            
            // Act
            const lexemes = LexemeCursor.getAllLexemesWithPosition(sql);
            
            // Assert
            expect(lexemes).toHaveLength(4);
            
            expect(lexemes[0].value).toBe('select');
            expect(lexemes[0].position!.startPosition).toBe(0);
            expect(lexemes[0].position!.endPosition).toBe(6);
            
            expect(lexemes[1].value).toBe('id');
            expect(lexemes[1].position!.startPosition).toBe(7);
            expect(lexemes[1].position!.endPosition).toBe(9);
            
            expect(lexemes[2].value).toBe('from');
            expect(lexemes[2].position!.startPosition).toBe(10);
            expect(lexemes[2].position!.endPosition).toBe(14);
            
            expect(lexemes[3].value).toBe('users');
            expect(lexemes[3].position!.startPosition).toBe(15);
            expect(lexemes[3].position!.endPosition).toBe(20);
        });

        it('should handle empty SQL', () => {
            // Arrange
            const sql = '';
            
            // Act
            const lexemes = LexemeCursor.getAllLexemesWithPosition(sql);
            
            // Assert
            expect(lexemes).toHaveLength(0);
        });
    });
});