import { Lexeme } from './models/Lexeme';
import { IdentifierTokenReader } from './tokenReaders/IdentifierTokenReader';
import { LiteralTokenReader } from './tokenReaders/LiteralTokenReader';
import { ParameterTokenReader } from './tokenReaders/ParameterTokenReader';
import { SymbolTokenReader } from './tokenReaders/SymbolTokenReader';
import { TokenReaderManager } from './tokenReaders/TokenReaderManager';

export class SqlTokenizer {
    /// <summary>
    /// Input string.
    /// </summary>
    private input: string;

    /// <summary>
    /// Current position in the input string.
    /// </summary>
    private position: number;

    /// <summary>
    /// Token reader manager
    /// </summary>
    private readerManager: TokenReaderManager;

    constructor(input: string) {
        this.input = input;
        this.position = 0;
        
        // Initialize the token reader manager and register all readers
        this.readerManager = new TokenReaderManager(input)
            .register(new ParameterTokenReader(input))
            .register(new LiteralTokenReader(input))
            .register(new IdentifierTokenReader(input))
            .register(new SymbolTokenReader(input));
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

        // Track the previous token
        let previous: Lexeme | null = null;

        // Read tokens until the end of the input is reached
        while (this.canRead()) {
            // Try to read with the reader manager
            const lexeme = this.readerManager.tryRead(this.position, previous);

            // If a token is read by any reader
            if (lexeme) {
                lexemes.push(lexeme);
                previous = lexeme;

                // Update position
                this.position = this.readerManager.getMaxPosition();

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
