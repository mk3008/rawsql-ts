import { Lexeme, TokenType } from '../models/Lexeme';
import { BaseTokenReader } from './BaseTokenReader';

// Prefix sets for quick checks
const STRING_SPECIFIERS = new Set(['e\'', 'E\'', 'x\'', 'X\'', 'b\'', 'B\'']);
const UNICODE_STRING_SPECIFIERS = new Set(['u&\'', 'U&\'']);

export class StringSpecifierTokenReader extends BaseTokenReader {

    /**
     * Try to read an escaped literal like e'...', x'...', etc.
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        const start = this.position;

        // Check for prefixed literals: e', x', b'
        if (this.canRead(1) && STRING_SPECIFIERS.has(this.input.slice(start, start + 2))) {
            this.position += 1;
            const result = this.createLexeme(TokenType.StringSpecifier, this.input.slice(start, this.position));
            return result;
        }

        // Check for unicode literal: u&'
        if (this.canRead(2) && UNICODE_STRING_SPECIFIERS.has(this.input.slice(start, start + 3))) {
            this.position += 2;
            const result = this.createLexeme(TokenType.StringSpecifier, this.input.slice(start, this.position));
            return result;
        }

        return null;
    }
}
