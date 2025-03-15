import { TokenType } from './enums/tokenType';

interface Lexeme {
    type: TokenType;
    value: string;
    command?: string; // Add the command property
}

export class SqlTokenizer {
    /// <summary>
    /// Input string.
    /// </summary>
    private input: string;

    /// <summary>
    /// Current position in the input string.
    /// </summary>
    private position: number;

    constructor(input: string) {
        this.input = input;
        this.position = 0;
    }

    private isEndOfInput(shift: number = 0): boolean {
        return this.position + shift >= this.input.length;
    }

    private canRead(shift: number = 0): boolean {
        return !this.isEndOfInput(shift);
    }

    private read(expectChar: string): string {
        if (this.isEndOfInput()) {
            throw new Error(`Unexpected character. expect: ${expectChar}, actual: EndOfInut, position: ${this.position}`);
        }

        if (this.input[this.position] !== expectChar) {
            throw new Error(`Unexpected character. expect: ${expectChar}, actual: ${this.input[this.position]}, position: ${this.position}`);
        }

        var char = this.input[this.position];
        this.position++;
        return char;
    }

    private static readonly SYMBOL_TOKENS: Record<string, TokenType> = {
        '.': TokenType.Dot,
        ',': TokenType.Comma,
        '(': TokenType.OpenParen,
        ')': TokenType.CloseParen,
    };

    private getDebugPositionInfo(errPosition: number): string {
        // Get 5 characters before and after the error
        // If the start and end points are out of the string range, keep them within the range
        // Display ^ at the error position on the next line
        const start = Math.max(0, errPosition - 5);
        const end = Math.min(this.input.length, errPosition + 5);
        const debugInfo = this.input.slice(start, end);
        const caret = ' '.repeat(errPosition - start) + '^';
        return `${debugInfo}\n${caret}`;
    }

    public readLexmes(): Lexeme[] {
        const lexemes: Lexeme[] = [];

        let lexeme: Lexeme | null = null;
        while ((lexeme = this.readLexme(lexeme)) !== null) {
            lexemes.push(lexeme);
        }
        return lexemes;
    }

    public readLexme(previous: Lexeme | null = null): Lexeme | null {
        // end of input
        if (this.isEndOfInput()) {
            return null;
        }

        this.skipWhiteSpacesAndComments();

        // current character
        const char = this.input[this.position];

        // Try each token type handler in order
        const lexeme = this.tryReadDecimalToken(char) ||
            this.tryReadSymbolToken(char) ||
            this.tryReadEscapedIdentifier(char, previous) ||
            this.tryReadParameter(char) ||
            this.tryReadStringLiteral(char) ||
            this.tryReadDigit(char) ||
            this.tryReadSignedNumber(char, previous) ||
            this.tryReadEscapedLiteral(char);

        if (lexeme) {
            return lexeme;
        }

        // Default to reading an identifier if no other token type matches
        const identifier = this.readIdentifier();
        return {
            type: TokenType.Identifier,
            value: identifier
        };
    }

    private tryReadDecimalToken(char: string): Lexeme | null {
        // digit tokens (prioritize dot for decimal point and delimiter)
        if (char === '.' && this.canRead(1) && /[0-9]/.test(this.input[this.position + 1])) {
            return {
                type: TokenType.Literal,
                value: this.readDigit()
            };
        }
        return null;
    }

    private tryReadSymbolToken(char: string): Lexeme | null {
        // symbol tokens
        if (char in SqlTokenizer.SYMBOL_TOKENS) {
            this.position++;
            return {
                type: SqlTokenizer.SYMBOL_TOKENS[char],
                value: char,
                command: char.toLowerCase()
            };
        }
        return null;
    }

    private tryReadEscapedIdentifier(char: string, previous: Lexeme | null): Lexeme | null {
        // MySQL escaped identifier (escape character is backtick)
        if (char === '`') {
            const identifier = this.readEscapedIdentifier('`');
            return {
                type: TokenType.Identifier,
                value: identifier
            };
        }

        // Postgres escaped identifier (escape character is double quote)
        if (char === '"') {
            const identifier = this.readEscapedIdentifier('"');
            return {
                type: TokenType.Identifier,
                value: identifier
            };
        }

        // SQLServer escaped identifier (escape character is square bracket)
        if (char === '[' && (previous === null || previous.command !== "array")) {
            const identifier = this.readEscapedIdentifier(']');
            return {
                type: TokenType.Identifier,
                value: identifier,
            };
        }

        return null;
    }

    private tryReadParameter(char: string): Lexeme | null {
        // named parameter
        const namedParameterPrefix = new Set(['@', ':', '$']);
        if (namedParameterPrefix.has(char)) {
            this.position++;
            const value = char + this.readIdentifier();
            return {
                type: TokenType.Parameter,
                value
            };
        }

        // nameless parameter
        if (char === '?') {
            this.position++;
            return {
                type: TokenType.Parameter,
                value: char
            };
        }

        return null;
    }

    private tryReadStringLiteral(char: string): Lexeme | null {
        // string literal
        if (char === '\'') {
            const value = this.readSingleQuotedString();
            return {
                type: TokenType.Literal,
                value
            };
        }

        return null;
    }

    private tryReadDigit(char: string): Lexeme | null {
        // digit tokens
        if (/[0-9]/.test(char)) {
            return {
                type: TokenType.Literal,
                value: this.readDigit()
            };
        }

        return null;
    }

    private tryReadSignedNumber(char: string, previous: Lexeme | null): Lexeme | null {
        // Check if this could be a signed number (not after a literal/identifier)
        const isValidNumericPrefix = previous === null ||
            (previous.type !== TokenType.Literal &&
                previous.type !== TokenType.Identifier);

        // positive number
        if (char === '+' && isValidNumericPrefix) {
            this.position++;
            this.skipWhiteSpacesAndComments();
            // removed positive sign
            return {
                type: TokenType.Literal,
                value: this.readDigit()
            };
        }

        // negative number
        if (char === '-' && isValidNumericPrefix) {
            this.position++;
            this.skipWhiteSpacesAndComments();
            // include negative sign
            return {
                type: TokenType.Literal,
                value: char + this.readDigit()
            };
        }

        return null;
    }

    private tryReadEscapedLiteral(char: string): Lexeme | null {
        const start = this.position;

        // Check for prefixed literals: e', x', b'
        const prefix = new Set(['e\'', 'x\'', 'b\'']);
        if (this.canRead(1) && prefix.has(this.input.slice(start, start + 2).toLocaleLowerCase())) {
            return this.readPrefixedLiteral(start, 2);
        }

        // Check for unicode literal: u&'
        if (this.canRead(2) && this.input.slice(start, start + 3).toLocaleLowerCase() === 'u&\'') {
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
            throw new Error(`Closing delimiter is not found. position: ${start}`);
        }

        return {
            type: TokenType.Literal,
            value: this.input.slice(start, this.position)
        };
    }

    private readDigit(): string {
        const start = this.position;
        let hasDot = false;
        let hasExponent = false;

        // Consider 0x, 0b, 0o
        const prefix = new Set(['0x', '0b', '0o']);
        if (this.canRead(1) && prefix.has(this.input.slice(start, 2).toLocaleLowerCase())) {
            this.position += 2;

            // Continue to get numeric and hexadecimal notation strings
            while (this.canRead() && /[0-9a-f]/i.test(this.input[this.position])) {
                this.position++;
            }

            return this.input.slice(start, this.position);
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
            } else if (!/[0-9]/.test(char)) {
                break;
            }

            this.position++;
        }

        if (start === this.position) {
            throw new Error(`Unexpected character. position: ${start}`);
        }

        if (this.input[start] === '.') {
            // If the number starts with a dot, add 0 to the front
            return '0' + this.input.slice(start, this.position);
        }

        return this.input.slice(start, this.position);
    }

    private readEscapedIdentifier(delimiter: string): string {
        const start = this.position;

        // Skip the opening delimiter
        this.position++;

        while (this.canRead()) {
            if (this.input[this.position] === delimiter) {
                break;
            }
            this.position++;
        }
        if (start === this.position) {
            throw new Error(`Closing delimiter is not found. position: ${start}, delimiter: ${delimiter}`);
        }

        // Skip the closing delimiter
        this.position++;

        // exclude the delimiter
        return this.input.slice(start + 1, this.position - 1);
    }

    private readSingleQuotedString(): string {
        const start = this.position;

        this.read('\'');

        while (this.canRead()) {
            var char = this.input[this.position];

            // escape character check
            if (char === '\\' && this.canRead(1) && this.input[this.position + 1] === '\'') {
                this.position += 2;
                continue;
            }
            else if (char === '\'') {
                break;
            }
            this.position++;
        }

        if (this.isEndOfInput()) {
            throw new Error(`Single quote is not closed. position: ${start}`);
        }

        const value = this.input.slice(start, this.position);
        this.position++;
        return value;
    }

    private readIdentifier(): string {
        const start = this.position;

        // Read until a delimiter appears
        // Space, dot, comma, parentheses, arithmetic operators
        // Note that underscores are treated as part of the word
        const delimiters = new Set([' ', '.', ',', '(', ')', '+', '-', '*', '/']);

        while (this.canRead()) {
            if (delimiters.has(this.input[this.position])) {
                break;
            }
            this.position++;
        }

        if (start === this.position) {
            throw new Error(`Unexpected character. position: ${start}\n${this.getDebugPositionInfo(start)}`);
        }

        return this.input.slice(start, this.position);
    }

    /// <summary>
    /// Skip white space characters and sql comments.
    /// </summary>
    private skipWhiteSpacesAndComments(): void {
        while (true) {
            if (this.skipWhiteSpace()) {
                continue;
            }
            if (this.skipLineComment()) {
                continue;
            }
            if (this.skipBlockComment()) {
                continue;
            }
            break;
        }
    }

    private skipWhiteSpace(): boolean {
        const start = this.position;

        // Skip tab, newline, and space characters
        const whitespace = new Set([' ', '\r', '\n', '\t']);

        while (this.canRead()) {
            if (!whitespace.has(this.input[this.position])) {
                break;
            }
            this.position++;
        }
        return start !== this.position;
    }

    private skipLineComment(): boolean {
        // At least 2 characters are needed. '--'
        if (this.isEndOfInput(1)) {
            return false;
        }

        if (this.input[this.position] === '-' && this.input[this.position + 1] === '-') {
            this.position += 2;

            while (this.canRead() && this.input[this.position] !== '\n') {
                this.position++;
            }
            return true;
        }

        return false;
    }

    private skipBlockComment(): boolean {
        // At least 4 characters are needed. '/**/'
        if (this.isEndOfInput(3)) {
            return false;
        }

        // Record the start position of the comment to track error location
        const start = this.position;

        if (this.input[this.position] === '/' && this.input[this.position + 1] === '*') {
            this.position += 2;

            while (this.canRead(1)) {
                if (this.input[this.position] === '*' && this.input[this.position + 1] === '/') {
                    this.position += 2;
                    return true;
                }
                this.position++;
            }

            throw new Error(`Block comment is not closed. position: ${start}`);
        }

        return false;
    }
}
