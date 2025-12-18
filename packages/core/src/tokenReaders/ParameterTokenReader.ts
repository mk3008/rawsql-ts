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

    private looksLikeSqlServerMoneyLiteral(): boolean {
        if (!this.canRead(1) || this.input[this.position] !== '$' || !CharLookupTable.isDigit(this.input[this.position + 1])) {
            return false;
        }

        // Read the leading digit run after '$' and then look for a decimal point or thousands separator.
        // This avoids mis-classifying PostgreSQL positional params like `$1, $2` as a MONEY literal.
        let pos = this.position + 1;
        while (pos < this.input.length && CharLookupTable.isDigit(this.input[pos])) {
            pos++;
        }

        if (pos + 1 < this.input.length && this.input[pos] === '.' && CharLookupTable.isDigit(this.input[pos + 1])) {
            return true;
        }

        if (pos + 1 < this.input.length && this.input[pos] === ',' && CharLookupTable.isDigit(this.input[pos + 1])) {
            return true;
        }

        return false;
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

            // Don't treat `:` as parameter prefix in array slice context [1:2]
            if (char === ':' && this.isInArraySliceContext()) {
                return null;
            }

            // Special handling for PostgreSQL dollar-quoted strings ($$ or $tag$)
            if (char === '$' && this.isDollarQuotedString()) {
                return null; // Let LiteralTokenReader handle it as dollar-quoted string
            }

            // Special handling for SQL Server MONEY literals ($123.45)
            // Only treat as MONEY if it contains decimal point or comma (not just $123)
            if (char === '$' && this.looksLikeSqlServerMoneyLiteral()) {
                return null; // Let LiteralTokenReader handle it as MONEY
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
     * Check if we're in an array slice context where : should be treated as an operator
     * Look backwards for an opening bracket that suggests array access
     */
    private isInArraySliceContext(): boolean {
        // Look backwards from current position to find opening bracket
        let pos = this.position - 1;
        let bracketDepth = 0;
        let parenDepth = 0;
        
        while (pos >= 0) {
            const char = this.input[pos];
            
            if (char === ']') {
                bracketDepth++;
            } else if (char === '[') {
                bracketDepth--;
                if (bracketDepth < 0) {
                    // Found unmatched opening bracket, check if it's array access context
                    // Array access context: after identifier, closing paren, or closing bracket
                    if (pos > 0) {
                        const prevChar = this.input[pos - 1];
                        // If previous char could end an expression (identifier, paren, bracket)
                        if (/[a-zA-Z0-9_)\]]/.test(prevChar)) {
                            return true;
                        }
                    }
                    // Also check if we're at start of input with brackets
                    if (pos === 0) {
                        return false; // Standalone [expr] is not array access
                    }
                    break;
                }
            } else if (char === ')') {
                parenDepth++;
            } else if (char === '(') {
                parenDepth--;
                // Continue searching even through parentheses as they might be function calls
                // in array slice context like arr[func(x):func(y)]
            }
            
            pos--;
        }
        
        return false;
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
