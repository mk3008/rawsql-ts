import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';
import { CharLookupTable } from '../utils/charLookupTable';
import { KeywordParser } from '../KeywordParser';
import { KeywordTrie } from '../models/KeywordTrie';

/**
 * Reads SQL literal tokens (numbers, strings)
 */

const keywords = [
    ["null"],
    ["true"],
    ["false"],
    ["current_date"],
    ["current_time"],
    ["current_timestamp"],
    ["localtime"],
    ["localtimestamp"],
    ["unbounded"],
    ["normalized"],
    ["nfc", "normalized"],
    ["nfd", "normalized"],
    ["nfkc", "normalized"],
    ["nfkd", "normalized"],
    ["nfc"],
    ["nfd"],
    ["nfkc"],
    ["nfkd"],
];
const trie = new KeywordTrie(keywords);
const parser = new KeywordParser(trie);

// Prefix sets for quick checks
const SINGLE_CHAR_ESCAPED_PREFIX = new Set(['e\'', 'E\'', 'x\'', 'X\'', 'b\'', 'B\'']);
const UNICODE_ESCAPED_PREFIX = new Set(['u&\'', 'U&\'']);

export class LiteralTokenReader extends BaseTokenReader {
    /**
     * Try to read a literal token
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        const char = this.input[this.position];

        // Check for keyword literals    
        const keyword = this.tryReadKeyword();
        if (keyword) {
            return keyword;
        }

        // Decimal token starting with a dot
        if (char === '.' && this.canRead(1) && CharLookupTable.isDigit(this.input[this.position + 1])) {
            return this.createLexeme(TokenType.Literal, this.readDigit());
        }

        // String literal
        if (char === '\'') {
            const value = this.readSingleQuotedString();
            return this.createLexeme(TokenType.Literal, value);
        }

        // Digit tokens
        if (CharLookupTable.isDigit(char)) {
            return this.createLexeme(TokenType.Literal, this.readDigit());
        }

        // Signed number
        if ((char === '+' || char === '-') && this.isValidNumericPrefix(previous)) {
            const sign = char;
            this.position++;

            // Skip whitespace after sign
            let pos = this.position;
            while (this.canRead() && CharLookupTable.isWhitespace(this.input[this.position])) {
                this.position++;
            }

            if (this.canRead() && (
                CharLookupTable.isDigit(this.input[this.position]) ||
                (this.input[this.position] === '.' &&
                    this.canRead(1) &&
                    CharLookupTable.isDigit(this.input[this.position + 1]))
            )) {
                return this.createLexeme(
                    TokenType.Literal,
                    sign === '-' ? sign + this.readDigit() : this.readDigit()
                );
            }

            // Not a number, restore position
            this.position = pos - 1; // Adjust for the increment at the beginning
        }

        // Check for prefixed literals
        return this.tryReadEscapedLiteral();
    }

    private tryReadKeyword(): Lexeme | null {
        // Check for keyword literals
        const result = parser.parse(this.input, this.position);
        if (result) {
            this.position = result.newPosition;
            return this.createLexeme(TokenType.Literal, result.keyword);
        }
        return null;
    }

    /**
     * Check if the current context allows for a signed number
     */
    private isValidNumericPrefix(previous: Lexeme | null): boolean {
        return previous === null ||
            (previous.type !== TokenType.Literal &&
                previous.type !== TokenType.Identifier);
    }

    /**
     * Read a numeric value
     */
    private readDigit(): string {
        const start = this.position;
        let hasDot = false;
        let hasExponent = false;

        // Consider 0x, 0b, 0o
        if (this.canRead(1) &&
            this.input[this.position] === '0' &&
            "xbo".includes(this.input[this.position + 1].toLowerCase())) {

            const prefixType = this.input[this.position + 1].toLowerCase();
            this.position += 2;

            // Continue to get numeric and hexadecimal notation strings
            const isHex = prefixType === 'x';
            while (this.canRead()) {
                const c = this.input[this.position];
                if (CharLookupTable.isDigit(c) || (isHex && CharLookupTable.isHexChar(c))) {
                    this.position++;
                } else {
                    break;
                }
            }

            return this.input.slice(start, this.position);
        }

        // If starting with dot, note it
        if (this.input[start] === '.') {
            hasDot = true;
            this.position++;
        }

        // Consider decimal point and exponential notation
        while (this.canRead()) {
            const char = this.input[this.position];

            if (char === '.' && !hasDot) {
                hasDot = true;
            } else if ((char === 'e' || char === 'E') && !hasExponent) {
                hasExponent = true;
                if (this.canRead(1) && (this.input[this.position + 1] === '+' || this.input[this.position + 1] === '-')) {
                    this.position++;
                }
            } else if (!CharLookupTable.isDigit(char)) {
                break;
            }

            this.position++;
        }

        if (start === this.position) {
            throw new Error(`Unexpected character. position: ${start}\n${this.getDebugPositionInfo(start)}`);
        }

        if (this.input[start] === '.') {
            // If the number starts with a dot, add 0 to the front
            return '0' + this.input.slice(start, this.position);
        }

        return this.input.slice(start, this.position);
    }

    /**
     * Read a string literal
     */
    private readSingleQuotedString(): string {
        const start = this.position;
        let closed = false;
        this.read('\'');

        while (this.canRead()) {
            const char = this.input[this.position];

            // escape character check
            if (char === '\\' && this.canRead(1) && this.input[this.position + 1] === '\'') {
                this.position += 2;
                continue;
            }
            else if (char === '\'') {
                this.position++;
                closed = true;
                break;
            }
            this.position++;
        }

        if (closed === false) {
            throw new Error(`Single quote is not closed. position: ${start}\n${this.getDebugPositionInfo(start)}`);
        }

        const value = this.input.slice(start, this.position);
        this.position++;
        return value;
    }

    /**
     * Try to read an escaped literal like e'...', x'...', etc.
     */
    private tryReadEscapedLiteral(): Lexeme | null {
        const start = this.position;

        // Check for prefixed literals: e', x', b'
        if (this.canRead(1) && SINGLE_CHAR_ESCAPED_PREFIX.has(this.input.slice(start, start + 2))) {
            return this.readPrefixedLiteral(start, 2);
        }

        // Check for unicode literal: u&'
        if (this.canRead(2) && UNICODE_ESCAPED_PREFIX.has(this.input.slice(start, start + 3))) {
            return this.readPrefixedLiteral(start, 3);
        }

        return null;
    }

    private readPrefixedLiteral(start: number, prefixLength: number): Lexeme {
        // Skip the prefix
        this.position += prefixLength;

        // Read until the closing quote
        while (this.canRead()) {
            if (this.input[this.position] === '\\' && this.canRead(1) && this.input[this.position + 1] === '\'') {
                // Skip escaped single quote
                this.position += 2;
                continue;
            }
            else if (this.input[this.position] === '\'') {
                // Found closing quote
                this.position++;
                break;
            }
            this.position++;
        }

        if (this.position <= start + prefixLength) {
            throw new Error(`Closing delimiter is not found. position: ${start}\n${this.getDebugPositionInfo(start)}`);
        }

        return {
            type: TokenType.Literal,
            value: this.input.slice(start, this.position)
        };
    }
}
