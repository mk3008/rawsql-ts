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

        // digit tokens (prioritize dot for decimal point and delimiter)
        if (char === '.' && this.canRead(1) && /[0-9]/.test(this.input[this.position + 1])) {
            return { type: TokenType.Literal, value: this.readDigit() };
        }

        // symbol tokens
        if (char in SqlTokenizer.SYMBOL_TOKENS) {
            this.position++;
            return { type: SqlTokenizer.SYMBOL_TOKENS[char], value: char, command: char.toLowerCase() };
        }

        // MySQL escaped identifier (escape character is backtick)
        if (char === '`') {
            this.position++;
            const identifier = this.readIdentifier();
            this.read('`');
            return { type: TokenType.Identifier, value: identifier, command: identifier.toLowerCase() };
        }

        // Postgres escaped identifier (escape character is double quote)
        if (char === '"') {
            this.position++;
            const identifier = this.readIdentifier();
            this.read('"');
            return { type: TokenType.Identifier, value: identifier, command: identifier.toLowerCase() };
        }

        // SQLServer escaped identifier (escape character is square bracket)
        if (char === '[' && (previous === null || previous.command !== "array")) {
            this.position++;
            const identifier = this.readIdentifier();
            this.read(']');
            return { type: TokenType.Identifier, value: identifier, command: identifier.toLowerCase() };
        }

        // named parameter
        const namedParameterPrefix = new Set(['@', ':', '$']);
        if (namedParameterPrefix.has(char)) {
            this.position++;
            const value = char + this.readIdentifier();
            return { type: TokenType.Parameter, value, command: value.toLowerCase() };
        }

        // nameless parameter
        if (char === '?') {
            this.position++;
            return { type: TokenType.Parameter, value: char, command: char.toLowerCase() };
        }

        // string literal
        if (char === '\'') {
            const value = this.readSingleQuotedString();
            return { type: TokenType.Literal, value, command: value.toLowerCase() };
        }

        const identifier = this.readIdentifier();
        return { type: TokenType.Identifier, value: identifier };
    }

    private readDigit(): string {
        const start = this.position;
        let hasDot = false;
        let hasExponent = false;

        // Consider 0x, 0b, 0o
        if (this.input[this.position] === '0' && this.canRead(1)) {
            const nextChar = this.input[this.position + 1].toLowerCase();
            if (nextChar === 'x' || nextChar === 'b' || nextChar === 'o') {
                this.position += 2;
                while (this.canRead() && /[0-9a-f]/i.test(this.input[this.position])) {
                    this.position++;
                }
                return this.input.slice(start, this.position);
            }
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
            throw new Error(`Unexpected character at position ${start}`);
        }

        return this.input.slice(start, this.position);
    }

    private readSingleQuotedString(): string {
        let start = this.position;

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
            throw new Error(`Syntax error: String is not closed. position: ${start}`);
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
            throw new Error(`Unexpected character at position ${start}`);
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

            const errorMessage = "Syntax error: Block comment is not closed.";
            const errorVariable = `position: ${start}`;
            throw new Error(`${errorMessage} ${errorVariable}`);
        }

        return false;
    }
}
