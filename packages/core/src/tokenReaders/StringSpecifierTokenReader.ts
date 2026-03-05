import { Lexeme, TokenType } from '../models/Lexeme';
import { BaseTokenReader } from './BaseTokenReader';

const QUOTE_CHAR_CODE = 39; // '
const AMPERSAND_CHAR_CODE = 38; // &

export class StringSpecifierTokenReader extends BaseTokenReader {

    /**
     * Try to read an escaped literal like e'...', x'...', etc.
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        const start = this.position;

        if (!this.canRead(1)) {
            return null;
        }

        const firstCode = this.input.charCodeAt(start);
        const secondCode = this.input.charCodeAt(start + 1);

        // Fast path for single-letter prefixes: e', E', x', X', b', B'
        if (secondCode === QUOTE_CHAR_CODE && this.isSingleLetterStringPrefix(firstCode)) {
            this.position = start + 1;
            return this.createLexeme(TokenType.StringSpecifier, this.input[start]);
        }

        // Fast path for unicode prefixes: u&', U&'
        if (this.canRead(2) &&
            this.isUnicodePrefix(firstCode) &&
            secondCode === AMPERSAND_CHAR_CODE &&
            this.input.charCodeAt(start + 2) === QUOTE_CHAR_CODE) {
            this.position = start + 2;
            return this.createLexeme(TokenType.StringSpecifier, this.input.slice(start, start + 2));
        }

        return null;
    }

    private isSingleLetterStringPrefix(charCode: number): boolean {
        return charCode === 69 ||  // E
               charCode === 101 || // e
               charCode === 88 ||  // X
               charCode === 120 || // x
               charCode === 66 ||  // B
               charCode === 98;    // b
    }

    private isUnicodePrefix(charCode: number): boolean {
        return charCode === 85 ||  // U
               charCode === 117;   // u
    }
}
