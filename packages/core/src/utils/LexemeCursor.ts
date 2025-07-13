import { Lexeme, TokenType } from '../models/Lexeme';

/**
 * Utility class for cursor-to-lexeme mapping in SQL text
 * Provides functionality to find lexemes at specific cursor positions for IDE integration
 */
export class LexemeCursor {
    private static readonly SQL_COMMANDS = new Set([
        'select', 'from', 'where', 'and', 'or', 'order', 'by', 'group', 'having',
        'limit', 'offset', 'as', 'on', 'inner', 'left', 'right', 'join', 'union',
        'insert', 'update', 'delete', 'into', 'values', 'set'
    ]);
    /**
     * Find the lexeme at the specified cursor position
     * @param sql The SQL string
     * @param cursorPosition The cursor position (0-based)
     * @returns The lexeme at the position, or null if not found
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
     * Get all lexemes with position information
     * @param sql The SQL string
     * @returns Array of lexemes with position information
     */
    public static getAllLexemesWithPosition(sql: string): Lexeme[] {
        if (!sql?.trim()) {
            return [];
        }

        try {
            const lexemes: Lexeme[] = [];
            let position = 0;
            
            while (position < sql.length) {
                position = this.skipWhitespace(sql, position);
                
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
     * Skip whitespace characters
     */
    private static skipWhitespace(sql: string, position: number): number {
        while (position < sql.length && /\s/.test(sql[position])) {
            position++;
        }
        return position;
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
        const nextNonWhitespacePos = this.skipWhitespace(sql, position);
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
}