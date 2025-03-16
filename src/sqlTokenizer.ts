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
        //
        // NOTE: The execution order of token readers is important.
        //       LiteralTokenReader <  SpecialSymbolTokenReader
        //       LiteralTokenReader <  OperatorTokenReader
        // - Since LiteralTokenReader has a process to read numeric literals starting with a dot,
        //   it needs to be registered before SpecialSymbolTokenReader.
        // - Since LiteralTokenReader has a process to read numeric literals starting with a sign,
        //   it needs to be registered before OperatorTokenReader.
        //
        // NOTE: The execution order of token readers is important.
        //       IdentifierTokenReader <  SpecialSymbolTokenReader
        //       IdentifierTokenReader <  OperatorTokenReader
        this.readerManager = new TokenReaderManager(input)
            .register(new ParameterTokenReader(input))
            .register(new LiteralTokenReader(input))            
            .register(new SpecialSymbolTokenReader(input))
            .register(new OperatorTokenReader(input))
            .register(new IdentifierTokenReader(input));
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
        this.position = StringUtils.skipWhiteSpacesAndComments(this.input, this.position);
    }

    /**
     * Get debug info for error reporting
     */
    private getDebugPositionInfo(errPosition: number): string {
        return StringUtils.getDebugPositionInfo(this.input, errPosition);
    }
}
