import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';
import { StringUtils } from '../utils/stringUtils';

/**
 * Reads SQL identifier tokens
 */
export class EscapedIdentifierTokenReader extends BaseTokenReader {
    /**
     * Try to read an identifier token
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        const char = this.input[this.position];

        // MySQL escaped identifier (escape character is backtick)
        if (char === '`') {
            const identifier = this.readEscapedIdentifier('`');
            return this.createLexeme(TokenType.Identifier, identifier);
        }

        // Postgres escaped identifier (escape character is double quote)
        if (char === '"') {
            const identifier = this.readEscapedIdentifier('"');
            return this.createLexeme(TokenType.Identifier, identifier);
        }

        // SQLServer escaped identifier (escape character is square bracket)
        if (char === '[' && this.isSqlServerBracketIdentifier(previous)) {
            const identifier = this.readEscapedIdentifier(']');
            return this.createLexeme(TokenType.Identifier, identifier);
        }

        return null;
    }

    /**
     * Check if the bracket at current position represents a SQL Server bracket identifier
     * vs array access notation
     */
    private isSqlServerBracketIdentifier(previous: Lexeme | null): boolean {
        // Don't treat as SQL Server bracket identifier if previous token suggests array access
        if (previous?.value === "array") {
            return false;
        }
        
        // Look ahead to see what's inside the brackets
        const start = this.position + 1; // after opening bracket
        let pos = start;
        
        // Scan until closing bracket or end of input
        while (pos < this.input.length && this.input[pos] !== ']') {
            const char = this.input[pos];
            
            // If we find colons, operators, or expressions, it's likely array access
            if (char === ':' || char === ',' || char === '+' || char === '-' || 
                char === '*' || char === '/' || char === '(' || char === ')') {
                return false;
            }
            
            pos++;
        }
        
        // If we didn't find a closing bracket, it's malformed anyway
        if (pos >= this.input.length) {
            return false;
        }
        
        // Check the content between brackets
        const content = this.input.slice(start, pos).trim();
        
        // Empty brackets are never SQL Server identifiers - they should be array access
        if (content === '') {
            return false;
        }
        
        // SQL Server bracket identifiers typically contain simple identifiers with dots
        // Array access contains numbers, expressions, colons
        return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(content);
    }

    /**
     * Read an escaped identifier (surrounded by delimiters)
     */
    private readEscapedIdentifier(delimiter: string): string {
        const start = this.position;

        // Skip the opening delimiter
        this.position++;

        let foundClosing = false;
        while (this.canRead()) {
            if (this.input[this.position] === delimiter) {
                foundClosing = true;
                break;
            }
            this.position++;
        }

        if (!foundClosing) {
            throw new Error(`Closing delimiter is not found. position: ${start}, delimiter: ${delimiter}\n${this.getDebugPositionInfo(start)}`);
        }

        if (start === this.position) {
            throw new Error(`Closing delimiter is not found. position: ${start}, delimiter: ${delimiter}\n${this.getDebugPositionInfo(start)}`);
        }

        // Skip the closing delimiter
        this.position++;

        // exclude the delimiter
        return this.input.slice(start + 1, this.position - 1);
    }
}
