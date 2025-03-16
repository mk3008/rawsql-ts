import { Lexeme } from './models/Lexeme';
import { IdentifierTokenReader } from './tokenReaders/IdentifierTokenReader';
import { LiteralTokenReader } from './tokenReaders/LiteralTokenReader';
import { ParameterTokenReader } from './tokenReaders/ParameterTokenReader';
import { SpecialSymbolTokenReader } from './tokenReaders/SymbolTokenReader';
import { TokenReaderManager } from './tokenReaders/TokenReaderManager';
import { OperatorTokenReader } from './tokenReaders/OperatorTokenReader';
import { StringUtils } from './utils/stringUtils';

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
        // NOTE: The execution order of token readers is important.
        // - Since LiteralTokenReader has a process to read numeric literals starting with a dot,
        //   it needs to be registered before SpecialSymbolTokenReader.
        // - Since LiteralTokenReader has a process to read numeric literals starting with a sign,
        //   it needs to be registered before OperatorTokenReader.
        this.readerManager = new TokenReaderManager(input)
            .register(new ParameterTokenReader(input))
            .register(new LiteralTokenReader(input))
            .register(new IdentifierTokenReader(input))
            .register(new SpecialSymbolTokenReader(input))
            .register(new OperatorTokenReader(input));
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
            // semicolon is a delimiter
            if (this.input[this.position] === ';') {
                return lexemes;
            }

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
                throw new Error(`Unexpected character. actual: ${this.input[this.position]}, position: ${this.position}\n${this.getDebugPositionInfo(this.position)}`);
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

    /**
     * Get debug info for error reporting
     */
    private getDebugPositionInfo(errPosition: number): string {
        return StringUtils.getDebugPositionInfo(this.input, errPosition);
    }
}
