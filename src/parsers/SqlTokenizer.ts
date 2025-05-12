import { Lexeme, TokenType } from '../models/Lexeme';
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
import { EscapedIdentifierTokenReader } from '../tokenReaders/EscapedIdentifierTokenReader';

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
            .register(new EscapedIdentifierTokenReader(input))
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
        // Pre-allocate array with estimated capacity for better performance
        const estimatedTokens = Math.ceil(this.input.length / 8); // Assuming average token length of 8 chars
        const lexemes: Lexeme[] = new Array(estimatedTokens);
        let lexemeCount = 0;

        // Read initial prefix comments
        const comment = this.readComment();
        let pendingComments = comment.lines;
        this.position = comment.position;

        // Track the previous token
        let previous: Lexeme | null = null;

        // Read tokens until the end of input is reached
        while (this.canRead()) {
            // Semicolon is a delimiter, so stop reading
            if (this.input[this.position] === ';') {
                break;
            }

            // Read using the token reader manager
            const lexeme = this.readerManager.tryRead(this.position, previous);

            if (lexeme === null) {
                throw new Error(`Unexpected character. actual: ${this.input[this.position]}, position: ${this.position}\n${this.getDebugPositionInfo(this.position)}`);
            }

            // Update position
            this.position = this.readerManager.getMaxPosition();

            // Read suffix comments
            const currentComment = this.readComment();
            this.position = currentComment.position;

            if ((lexeme.type & TokenType.Comma) || (lexeme.type & TokenType.Operator)) {
                // Carry over comments after commas or operators
                if (currentComment.lines.length > 0) {
                    pendingComments.push(...currentComment.lines);
                }
            } else {
                // Add comments to the current token if any
                const hasComments = pendingComments.length > 0 || currentComment.lines.length > 0;
                if (hasComments) {
                    this.addCommentsToToken(lexeme, pendingComments, currentComment.lines);
                }
                pendingComments = []; // Clear as they are processed
            }

            lexemes[lexemeCount++] = lexeme;
            previous = lexeme;
        }

        // Add any pending comments to the last token
        if (pendingComments.length > 0 && lexemeCount > 0) {
            const lastToken = lexemes[lexemeCount - 1];
            if (lastToken.comments === null) {
                lastToken.comments = [];
            }
            lastToken.comments.push(...pendingComments);
        }

        // Trim the array to actual size used
        return lexemeCount === estimatedTokens ? lexemes : lexemes.slice(0, lexemeCount);
    }

    /**
     * Adds pending comments to the last token.
     */
    private addPendingCommentsToLastToken(lexemes: Lexeme[], pendingComments: string[]): void {
        if (pendingComments.length > 0 && lexemes.length > 0) {
            const lastToken = lexemes[lexemes.length - 1];
            if (lastToken.comments === null) {
                lastToken.comments = [];
            }
            lastToken.comments.push(...pendingComments);
        }
    }

    /**
     * Adds comments to the token.
     */
    private addCommentsToToken(lexeme: Lexeme, prefixComments: string[], suffixComments: string[]): void {
        const hasComments = prefixComments.length > 0 || suffixComments.length > 0;

        if (hasComments) {
            if (lexeme.comments === null) {
                lexeme.comments = [];
            }

            // Add prefix comments to the beginning.
            if (prefixComments.length > 0) {
                lexeme.comments.unshift(...prefixComments);
            }

            // Add suffix comments to the end.
            if (suffixComments.length > 0) {
                lexeme.comments.push(...suffixComments);
            }
        }
    }

    /**
     * Skips whitespace characters and SQL comments in the input.
     * 
     * @remarks This method updates the position pointer.
     */
    private readComment(): { position: number, lines: string[] } {
        return StringUtils.readWhiteSpaceAndComment(this.input, this.position);
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
