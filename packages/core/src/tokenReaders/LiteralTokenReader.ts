import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';
import { CharLookupTable } from '../utils/charLookupTable';
import { KeywordParser } from '../parsers/KeywordParser';
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
export const literalKeywordParser = new KeywordParser(trie);

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
            const value = this.readSingleQuotedString(false);
            return this.createLexeme(TokenType.Literal, value);
        }

        // Digit tokens
        if (CharLookupTable.isDigit(char)) {
            return this.createLexeme(TokenType.Literal, this.readDigit());
        }

        // PostgreSQL dollar-quoted string ($$content$$ or $tag$content$tag$)
        if (char === '$' && this.isDollarQuotedString()) {
            return this.createLexeme(TokenType.Literal, this.readDollarQuotedString());
        }

        // SQL Server MONEY literal ($123.45)
        // Only treat as MONEY if it contains decimal point or comma to avoid conflict with PostgreSQL $1 parameters
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
                const start = this.position;
                this.position++; // Skip $
                const numberPart = this.readMoneyDigit();
                return this.createLexeme(TokenType.Literal, '$' + numberPart);
            }
        }

        // Signed number
        if ((char === '+' || char === '-') && this.determineSignOrOperator(previous) === "sign") {
            const sign = char;
            this.position++;

            // Skip whitespace after sign
            const pos = this.position;
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

        return null;
    }

    private tryReadKeyword(): Lexeme | null {
        // Check for keyword literals
        const result = literalKeywordParser.parse(this.input, this.position);
        if (result) {
            this.position = result.newPosition;
            return this.createLexeme(TokenType.Literal, result.keyword);
        }
        return null;
    }

    /**
     * Determines if the current context treats '+' or '-' as a numeric sign or an operator.
     * This method is used to differentiate between operators and numeric signs (e.g., '+' or '-').
     *
     * For example:
     * - In `1-1`, the '-' is treated as an operator, so the expression is split into `1`, `-`, and `1`.
     * - In `-1`, the '-' is treated as a sign, making `-1` a single, indivisible literal.
     *
     * The logic for determining whether '+' or '-' is a sign or an operator is as follows:
     * - If there is no previous lexeme, it is considered the start of the input, so the sign is valid.
     * - If the previous lexeme is a literal, identifier, parameter, or closing parenthesis, the sign is treated as an operator.
     *
     * @param previous The previous lexeme in the input stream.
     * @returns "sign" if the context allows for a numeric sign, otherwise "operator".
     */
    private determineSignOrOperator(previous: Lexeme | null): "sign" | "operator" {
        // If there is no previous lexeme, treat as a sign
        if (previous === null) {
            return "sign";
        }

        // If the previous lexeme is a literal, identifier, parameter, or closing parenthesis, treat as an operator
        const isOperatorContext = (previous.type & TokenType.Literal) || 
                                  (previous.type & TokenType.Identifier) || 
                                  (previous.type & TokenType.Parameter) || 
                                  (previous.type & TokenType.CloseParen);
        return isOperatorContext ? "operator" : "sign";
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
     * Read a MONEY value (allows commas as thousand separators)
     */
    private readMoneyDigit(): string {
        const start = this.position;
        let hasDot = false;

        // Consider decimal point and comma separators
        while (this.canRead()) {
            const char = this.input[this.position];

            if (char === '.' && !hasDot) {
                hasDot = true;
            } else if (char === ',' && !hasDot) {
                // Allow comma as thousand separator before decimal point
            } else if (!CharLookupTable.isDigit(char)) {
                break;
            }

            this.position++;
        }

        if (start === this.position) {
            throw new Error(`Unexpected character. position: ${start}\n${this.getDebugPositionInfo(start)}`);
        }

        return this.input.slice(start, this.position);
    }

    /**
     * Read a string literal
     */
    private readSingleQuotedString(includeSingleQuote: boolean): string {
        const start = this.position;
        let closed = false;
        this.read("'");

        while (this.canRead()) {
            const char = this.input[this.position];
            this.position++;

            // escape character check
            if (char === "\\" && this.canRead(1)) {
                this.position++;
                continue;
            }
            else if (char === '\'') {
                closed = true;
                break;
            }
        }

        if (closed === false) {
            throw new Error(`Single quote is not closed. position: ${start}\n${this.getDebugPositionInfo(start)}`);
        }

        if (includeSingleQuote) {
            const value = this.input.slice(start, this.position);
            return value;
        } else {
            const value = this.input.slice(start + 1, this.position - 1);
            return value;
        }
    }

    /**
     * Check if the current position starts a PostgreSQL dollar-quoted string
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
        let pos = this.position + 1;
        while (pos < this.input.length) {
            const char = this.input[pos];
            if (char === '$') {
                return true;
            }
            if (!this.isAlphanumeric(char) && char !== '_') {
                return false;
            }
            pos++;
        }

        return false;
    }

    /**
     * Read a PostgreSQL dollar-quoted string
     */
    private readDollarQuotedString(): string {
        const start = this.position;
        
        // Read the opening tag
        this.position++; // Skip initial $
        let tag = '';
        
        // Read tag characters until the closing $
        while (this.canRead() && this.input[this.position] !== '$') {
            tag += this.input[this.position];
            this.position++;
        }
        
        if (!this.canRead()) {
            throw new Error(`Unexpected end of input while reading dollar-quoted string tag at position ${start}`);
        }
        
        this.position++; // Skip closing $ of opening tag
        
        // Now read the content until we find the closing tag
        const openingTag = '$' + tag + '$';
        const closingTag = openingTag;
        let content = '';
        
        while (this.canRead()) {
            // Check if we're at the start of the closing tag
            if (this.input.substring(this.position, this.position + closingTag.length) === closingTag) {
                // Found closing tag
                this.position += closingTag.length;
                return openingTag + content + closingTag;
            }
            
            content += this.input[this.position];
            this.position++;
        }
        
        throw new Error(`Unclosed dollar-quoted string starting at position ${start}. Expected closing tag: ${closingTag}`);
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
