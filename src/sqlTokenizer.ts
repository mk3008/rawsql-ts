import { Lexeme } from './models/Lexeme';
import { IdentifierTokenReader } from './tokenReaders/IdentifierTokenReader';
import { LiteralTokenReader } from './tokenReaders/LiteralTokenReader';
import { ParameterTokenReader } from './tokenReaders/ParameterTokenReader';
import { SymbolTokenReader } from './tokenReaders/SymbolTokenReader';

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

    public readLexmes(): Lexeme[] {
        const lexemes: Lexeme[] = [];

        // Skip whitespace and comments at the start
        this.skipWhiteSpacesAndComments();

        // Initialize each token reader
        const symbolReader = new SymbolTokenReader(this.input, this.position);
        const identifierReader = new IdentifierTokenReader(this.input, this.position);
        const literalReader = new LiteralTokenReader(this.input, this.position);
        const parameterReader = new ParameterTokenReader(this.input, this.position);

        // Track the previous token
        let previous: Lexeme | null = null;

        // Read tokens until the end of the input is reached
        while (this.canRead()) {
            let lexeme: Lexeme | null = null;

            // Attempt to read with each reader in order
            parameterReader.setPosition(this.position);
            lexeme = parameterReader.tryRead(previous);

            if (!lexeme) {
                literalReader.setPosition(this.position);
                lexeme = literalReader.tryRead(previous);
            }

            if (!lexeme) {
                identifierReader.setPosition(this.position);
                lexeme = identifierReader.tryRead(previous);
            }

            if (!lexeme) {
                symbolReader.setPosition(this.position);
                lexeme = symbolReader.tryRead(previous);
            }

            // If a token is read by any reader
            if (lexeme) {
                lexemes.push(lexeme);
                previous = lexeme;

                // Update position
                const newPos = Math.max(
                    symbolReader.getPosition(),
                    literalReader.getPosition(),
                    identifierReader.getPosition(),
                    parameterReader.getPosition()
                );
                this.position = newPos;

                // Skip whitespace and comments after the token
                this.skipWhiteSpacesAndComments();
            } else {
                // Exception
                throw new Error(`Unexpected character. actual: ${this.input[this.position]}, position: ${this.position}`);
            }
        }

        return lexemes;
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
