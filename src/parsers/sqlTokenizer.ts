import { Lexeme } from '../models/Lexeme';
import { IdentifierTokenReader } from '../tokenReaders/IdentifierTokenReader';
import { LiteralTokenReader } from '../tokenReaders/LiteralTokenReader';
import { ParameterTokenReader } from '../tokenReaders/ParameterTokenReader';
import { SpecialSymbolTokenReader } from '../tokenReaders/SymbolTokenReader';
import { TokenReaderManager } from '../tokenReaders/TokenReaderManager';
import { OperatorTokenReader } from '../tokenReaders/OperatorTokenReader';
import { StringUtils } from '../utils/stringUtils';
import { CommandTokenReader } from '../tokenReaders/CommandTokenReader';
import { StringSpecifierTokenReader } from '../tokenReaders/StringSpecifierTokenReader';
import { FunctionTokenReader } from '../tokenReaders/FunctionTokenReader';
import { TypeTokenReader } from '../tokenReaders/TypeTokenReader';

/**
 * Class responsible for tokenizing SQL input.
 */
export class SqlTokenizer {
    /**
     * The input SQL string to be tokenized.
     */
    private input: string;

    /**
     * Current position within the input string.
     */
    private position: number;

    /**
     * Manager responsible for handling token readers.
     */
    private readerManager: TokenReaderManager;

    /**
     * Initializes a new instance of the SqlTokenizer.
     */
    constructor(input: string) {
        this.input = input;
        this.position = 0;

        // Initialize the token reader manager and register all readers
        this.readerManager = new TokenReaderManager(input)
            .register(new ParameterTokenReader(input))
            .register(new StringSpecifierTokenReader(input))
            // LiteralTokenReader should be registered before SpecialSymbolTokenReader and OperatorTokenReader
            // Reason: To prevent numeric literals starting with a dot or sign from being misrecognized as operators
            // e.g. `1.0` is a literal, not an operator
            .register(new LiteralTokenReader(input))
            .register(new SpecialSymbolTokenReader(input))
            .register(new CommandTokenReader(input))
            .register(new OperatorTokenReader(input))
            // TypeTokenReader should be registered before FunctionTokenReader
            // Reason: To prevent types containing parentheses from being misrecognized as functions
            // e.g. `numeric(10, 2)` is a type, not a function
            .register(new TypeTokenReader(input))
            .register(new FunctionTokenReader(input))
            .register(new IdentifierTokenReader(input)) // IdentifierTokenReader should be registered last
            ;
    }

    /**
     * Checks if the end of input is reached.
     * 
     * @param shift - The shift to consider beyond the current position.
     * @returns True if the end of input is reached; otherwise, false.
     */
    private isEndOfInput(shift: number = 0): boolean {
        return this.position + shift >= this.input.length;
    }

    /**
     * Checks if more input can be read.
     * 
     * @param shift - The shift to consider beyond the current position.
     * @returns True if more input can be read; otherwise, false.
     */
    private canRead(shift: number = 0): boolean {
        return !this.isEndOfInput(shift);
    }

    /**
     * Reads the lexemes from the input string.
     * 
     * @returns An array of lexemes extracted from the input string.
     * @throws Error if an unexpected character is encountered.
     */
    public readLexmes(): Lexeme[] {
        const lexemes: Lexeme[] = [];

        // Skip whitespace and comments at the start
        let prevComment = this.readComments();
        this.position = prevComment.position;

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
                // Update position
                this.position = this.readerManager.getMaxPosition();

                // lexeme.commentsの先頭に追加する
                if (prevComment.comments) {
                    if (lexeme.comments) {
                        lexeme.comments.unshift(...prevComment.comments);
                    } else {
                        lexeme.comments = prevComment.comments;
                    }
                }

                // Skip whitespace and comments after the token
                prevComment = this.readComments();
                this.position = prevComment.position;

                lexemes.push(lexeme);
                previous = lexeme;
            } else {
                // Exception
                throw new Error(`Unexpected character. actual: ${this.input[this.position]}, position: ${this.position}\n${this.getDebugPositionInfo(this.position)}`);
            }
        }

        return lexemes;
    }

    /**
     * Skips whitespace characters and SQL comments in the input.
     * 
     * @remarks This method updates the position pointer.
     */
    private readComments(): { position: number, comments: string[] | null } {
        return StringUtils.readComments(this.input, this.position);
    }

    /**
     * Gets debug information for error reporting.
     * 
     * @param errPosition - The position where the error occurred.
     * @returns A string containing the debug position information.
     */
    private getDebugPositionInfo(errPosition: number): string {
        return StringUtils.getDebugPositionInfo(this.input, errPosition);
    }
}
