import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';
import { CharLookupTable } from '../utils/charLookupTable';

/**
 * Reads SQL parameter tokens (@param, :param, $param, ?, ${param})
 */
export class ParameterTokenReader extends BaseTokenReader {
    constructor(input: string) {
        super(input);
    }

    /**
     * Try to read a parameter token
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        // parameter with suffix (${param}) - check this first
        if (this.canRead(1) && this.input[this.position] === '$' && this.input[this.position + 1] === '{') {
            this.position += 2; // Skip ${
            const start = this.position;
            while (this.canRead() && this.input[this.position] !== '}') {
                this.position++;
            }
            if (this.isEndOfInput()) {
                throw new Error(`Unexpected end of input. Expected closing '}' for parameter at position ${start}`);
            }

            const identifier = this.input.slice(start, this.position);
            if (identifier.length === 0) {
                throw new Error('Empty parameter name is not allowed: found ${} at position ' + (start - 2));
            }

            this.position++; // Skip }
            return this.createLexeme(TokenType.Parameter, '${' + identifier + '}');
        }

        const char = this.input[this.position];

        // named parameter (@param, :param, $param)
        if (CharLookupTable.isNamedParameterPrefix(char)) {

            // However, do not recognize as a parameter if the next character is an operator symbol
            // To avoid postgres `::`
            if (this.canRead(1) && CharLookupTable.isOperatorSymbol(this.input[this.position + 1])) {
                return null;
            }

            // Special handling for PostgreSQL dollar-quoted strings ($$ or $tag$)
            if (char === '$' && this.isDollarQuotedString()) {
                return null; // Let LiteralTokenReader handle it as dollar-quoted string
            }

            // Special handling for SQL Server MONEY literals ($123.45)
            // Only treat as MONEY if it contains decimal point or comma (not just $123)
            if (char === '$' && this.canRead(1) && CharLookupTable.isDigit(this.input[this.position + 1])) {
                // Look ahead to see if this looks like a MONEY literal (has . or ,)
                let pos = this.position + 1;
                let hasDecimalOrComma = false;
                while (pos < this.input.length && (CharLookupTable.isDigit(this.input[pos]) || this.input[pos] === ',' || this.input[pos] === '.')) {
                    if (this.input[pos] === '.' || this.input[pos] === ',') {
                        hasDecimalOrComma = true;
                        break;
                    }
                    pos++;
                }
                
                if (hasDecimalOrComma) {
                    return null; // Let LiteralTokenReader handle it as MONEY
                }
                // Otherwise, treat as parameter (e.g., $1, $123)
            }

            this.position++;

            // Read the identifier part after the prefix
            const start = this.position;
            while (this.canRead() && !CharLookupTable.isDelimiter(this.input[this.position])) {
                this.position++;
            }

            const identifier = this.input.slice(start, this.position);
            return this.createLexeme(TokenType.Parameter, char + identifier);
        }

        // nameless parameter (?)
        // However, do not recognize as a parameter if it could be a JSON operator
        if (char === '?') {
            // Check for JSON operators ?| and ?&
            if (this.canRead(1)) {
                const nextChar = this.input[this.position + 1];
                if (nextChar === '|' || nextChar === '&') {
                    return null; // Let OperatorTokenReader handle it
                }
            }
            
            // If previous token is an identifier or literal, ? might be a JSON operator
            if (previous && (previous.type & TokenType.Identifier || previous.type & TokenType.Literal)) {
                return null; // Let OperatorTokenReader handle it
            }
            
            this.position++;
            return this.createLexeme(TokenType.Parameter, char);
        }

        return null;
    }

    /**
     * Check if the current position starts a PostgreSQL dollar-quoted string
     * Patterns: $$ or $tag$
     */
    private isDollarQuotedString(): boolean {
        if (!this.canRead(1)) {
            return false;
        }

        // Check for $$ pattern
        if (this.input[this.position + 1] === '$') {
            return true;
        }

        // Check for $tag$ pattern
        // Look for the closing $ after the tag
        let pos = this.position + 1;
        while (pos < this.input.length) {
            const char = this.input[pos];
            if (char === '$') {
                // Found closing $ - this looks like $tag$ pattern
                return true;
            }
            // Tag can contain letters, digits, underscores
            if (!this.isAlphanumeric(char) && char !== '_') {
                // Invalid character for tag, not a dollar-quoted string
                return false;
            }
            pos++;
        }

        // No closing $ found
        return false;
    }

    /**
     * Check if character is alphanumeric (letter or digit)
     */
    private isAlphanumeric(char: string): boolean {
        if (char.length !== 1) return false;
        const code = char.charCodeAt(0);
        // Check if digit (0-9) or letter (a-z, A-Z)
        return (code >= 48 && code <= 57) ||  // 0-9
               (code >= 65 && code <= 90) ||  // A-Z
               (code >= 97 && code <= 122);   // a-z
    }
}
