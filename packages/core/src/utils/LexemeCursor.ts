import { Lexeme, TokenType } from '../models/Lexeme';
import { StringUtils } from './stringUtils';

/**
 * Line and column position (1-based indexing for editor integration)
 */
export interface LineColumn {
    line: number;      // 1-based line number
    column: number;    // 1-based column number
}

/**
 * Utility class for cursor-to-lexeme mapping in SQL text.
 * 
 * Provides functionality to find lexemes at specific cursor positions for IDE integration.
 * Handles SQL parsing with proper comment and whitespace handling for editor features.
 * 
 * @example Basic usage
 * ```typescript
 * const sql = "SELECT id FROM users WHERE active = true";
 * const lexeme = LexemeCursor.findLexemeAtPosition(sql, 7); // position at 'id'
 * console.log(lexeme?.value); // 'id'
 * ```
 */
export class LexemeCursor {
    private static readonly SQL_COMMANDS = new Set([
        'select', 'from', 'where', 'and', 'or', 'order', 'by', 'group', 'having',
        'limit', 'offset', 'as', 'on', 'inner', 'left', 'right', 'join', 'union',
        'insert', 'update', 'delete', 'into', 'values', 'set'
    ]);
    /**
     * Find the lexeme at the specified line and column position.
     * 
     * Designed for GUI editor integration where users select alias text.
     * Uses 1-based line and column indexing to match editor conventions.
     * 
     * @param sql - The SQL string to analyze
     * @param position - Line and column position (1-based)
     * @returns The lexeme at the position, or null if not found
     * 
     * @example
     * ```typescript
     * const sql = "SELECT user_id FROM orders";
     * const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, { line: 1, column: 8 });
     * console.log(lexeme?.value); // 'user_id'
     * ```
     */
    public static findLexemeAtLineColumn(sql: string, position: LineColumn): Lexeme | null {
        const charOffset = this.lineColumnToCharOffset(sql, position);
        if (charOffset === -1) {
            return null;
        }
        return this.findLexemeAtPosition(sql, charOffset);
    }

    /**
     * Find the lexeme at the specified cursor position.
     * 
     * Performs intelligent SQL parsing with proper comment and whitespace handling.
     * Returns null if cursor is in whitespace or comments.
     * 
     * @param sql - The SQL string to analyze
     * @param cursorPosition - The cursor position (0-based character offset)
     * @returns The lexeme at the position, or null if not found
     * 
     * @example
     * ```typescript
     * const sql = "SELECT user_id FROM orders";
     * const lexeme = LexemeCursor.findLexemeAtPosition(sql, 7);
     * console.log(lexeme?.value); // 'user_id'
     * ```
     */
    public static findLexemeAtPosition(sql: string, cursorPosition: number): Lexeme | null {
        if (cursorPosition < 0 || cursorPosition >= sql.length) {
            return null;
        }

        const lexemes = this.getAllLexemesWithPosition(sql);
        
        for (const lexeme of lexemes) {
            if (lexeme.position && 
                cursorPosition >= lexeme.position.startPosition && 
                cursorPosition < lexeme.position.endPosition) {
                return lexeme;
            }
        }
        
        return null;
    }

    /**
     * Get all lexemes with position information from SQL text.
     * 
     * Tokenizes the entire SQL string with precise position information.
     * Useful for syntax highlighting, code analysis, and editor features.
     * 
     * @param sql - The SQL string to tokenize
     * @returns Array of lexemes with position information (excludes comments/whitespace)
     * 
     * @example
     * ```typescript
     * const sql = "SELECT id FROM users";
     * const lexemes = LexemeCursor.getAllLexemesWithPosition(sql);
     * lexemes.forEach(l => console.log(`${l.value} at ${l.position.startPosition}`));
     * ```
     */
    public static getAllLexemesWithPosition(sql: string): Lexeme[] {
        if (!sql?.trim()) {
            return [];
        }

        try {
            const lexemes: Lexeme[] = [];
            let position = 0;
            
            while (position < sql.length) {
                position = this.skipWhitespaceAndComments(sql, position);
                
                if (position >= sql.length) {
                    break;
                }
                
                const lexeme = this.parseNextToken(sql, position);
                if (lexeme) {
                    lexemes.push(lexeme);
                    position = lexeme.position!.endPosition;
                } else {
                    position++; // Skip unknown character
                }
            }
            
            return lexemes;
        } catch (error) {
            return [];
        }
    }

    /**
     * Skip whitespace and comments, returning new position
     */
    private static skipWhitespaceAndComments(sql: string, position: number): number {
        const result = StringUtils.readWhiteSpaceAndComment(sql, position);
        return result.position;
    }

    /**
     * Parse the next token starting at the given position
     */
    private static parseNextToken(sql: string, startPos: number): Lexeme | null {
        const char = sql[startPos];
        
        // String literals
        if (char === "'" || char === '"') {
            return this.parseStringLiteral(sql, startPos);
        }
        
        // Operators and special characters
        if (/[=<>!+\-*/%().*]/.test(char)) {
            return this.parseOperator(sql, startPos);
        }
        
        // Comma
        if (char === ',') {
            return this.createLexeme(TokenType.Comma, ',', startPos, startPos + 1);
        }
        
        // Word tokens (identifiers, commands, functions)
        if (/[a-zA-Z0-9_]/.test(char)) {
            return this.parseWordToken(sql, startPos);
        }
        
        return null;
    }

    /**
     * Parse string literal tokens
     */
    private static parseStringLiteral(sql: string, startPos: number): Lexeme {
        const quote = sql[startPos];
        let position = startPos + 1;
        let token = quote;
        
        while (position < sql.length && sql[position] !== quote) {
            token += sql[position++];
        }
        
        if (position < sql.length) {
            token += sql[position++]; // closing quote
        }
        
        return this.createLexeme(TokenType.Literal, token, startPos, position);
    }

    /**
     * Parse operator tokens
     */
    private static parseOperator(sql: string, startPos: number): Lexeme {
        let token = sql[startPos];
        let position = startPos + 1;
        
        // Handle compound operators (<=, >=, !=, etc.)
        if (position < sql.length && /[=<>!]/.test(sql[position]) && /[=<>!]/.test(token)) {
            token += sql[position++];
        }
        
        const tokenType = this.getOperatorTokenType(token);
        return this.createLexeme(tokenType, token, startPos, position);
    }

    /**
     * Parse word tokens (identifiers, commands, functions)
     */
    private static parseWordToken(sql: string, startPos: number): Lexeme {
        let position = startPos;
        let token = '';
        
        while (position < sql.length && /[a-zA-Z0-9_]/.test(sql[position])) {
            token += sql[position++];
        }
        
        const tokenType = this.getWordTokenType(token, sql, position);
        const value = this.shouldLowercase(tokenType) ? token.toLowerCase() : token;
        
        return this.createLexeme(tokenType, value, startPos, position);
    }

    /**
     * Determine the token type for operators
     */
    private static getOperatorTokenType(token: string): number {
        switch (token) {
            case '(': return TokenType.OpenParen;
            case ')': return TokenType.CloseParen;
            case '*': return TokenType.Identifier; // Treat * as identifier for SELECT *
            default: return TokenType.Operator;
        }
    }

    /**
     * Determine the token type for word tokens
     */
    private static getWordTokenType(token: string, sql: string, position: number): number {
        const lowerToken = token.toLowerCase();
        
        // Check if it's a command
        if (this.SQL_COMMANDS.has(lowerToken)) {
            return TokenType.Command;
        }
        
        // Check if it's followed by parentheses (function)
        const nextNonWhitespacePos = this.skipWhitespaceAndComments(sql, position);
        if (nextNonWhitespacePos < sql.length && sql[nextNonWhitespacePos] === '(') {
            return TokenType.Function;
        }
        
        return TokenType.Identifier;
    }

    /**
     * Check if token value should be lowercased
     */
    private static shouldLowercase(tokenType: number): boolean {
        return !!(tokenType & TokenType.Command) || 
               !!(tokenType & TokenType.Operator) || 
               !!(tokenType & TokenType.Function);
    }

    /**
     * Create a lexeme with position information
     */
    private static createLexeme(type: number, value: string, startPos: number, endPos: number): Lexeme {
        return {
            type,
            value,
            comments: null,
            position: {
                startPosition: startPos,
                endPosition: endPos
            }
        };
    }

    /**
     * Convert line and column position to character offset.
     * 
     * @param sql - The SQL string
     * @param position - Line and column position (1-based)
     * @returns Character offset (0-based), or -1 if position is out of bounds
     */
    private static lineColumnToCharOffset(sql: string, position: LineColumn): number {
        if (position.line < 1 || position.column < 1) {
            return -1;
        }

        const lines = sql.split('\n');
        
        if (position.line > lines.length) {
            return -1; // Line out of bounds
        }
        
        const targetLine = lines[position.line - 1];
        if (position.column > targetLine.length + 1) {
            return -1; // Column out of bounds
        }
        
        // Calculate character offset
        let offset = 0;
        for (let i = 0; i < position.line - 1; i++) {
            offset += lines[i].length + 1; // +1 for newline character
        }
        offset += position.column - 1;
        
        return offset;
    }

    /**
     * Convert character offset to line and column position.
     * 
     * @param sql - The SQL string
     * @param charOffset - Character offset (0-based)
     * @returns Line and column position (1-based), or null if offset is out of bounds
     */
    public static charOffsetToLineColumn(sql: string, charOffset: number): LineColumn | null {
        if (charOffset < 0 || charOffset > sql.length) {
            return null;
        }
        
        const lines = sql.split('\n');
        let currentOffset = 0;
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const lineLength = lines[lineIndex].length;
            
            // Check if the offset is within this line
            if (charOffset < currentOffset + lineLength) {
                return {
                    line: lineIndex + 1,
                    column: charOffset - currentOffset + 1
                };
            }
            
            // Check if the offset is exactly at the end of this line (newline position)
            if (charOffset === currentOffset + lineLength && lineIndex < lines.length - 1) {
                // Position at newline - return start of next line
                return {
                    line: lineIndex + 2,
                    column: 1
                };
            }
            
            currentOffset += lineLength + 1; // +1 for newline character
        }
        
        // Handle position at the very end of the text
        if (charOffset === sql.length) {
            const lastLine = lines[lines.length - 1];
            return {
                line: lines.length,
                column: lastLine.length + 1
            };
        }
        
        return null;
    }
}