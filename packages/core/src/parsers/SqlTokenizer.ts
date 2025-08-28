import { Lexeme, TokenType } from '../models/Lexeme';
import { FormattingLexeme } from '../models/FormattingLexeme';
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
 * Options for tokenization behavior
 */
export interface TokenizeOptions {
    preserveFormatting?: boolean;
}

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
     * Tokenizes the input SQL with optional formatting preservation.
     */
    public tokenize(): Lexeme[];
    public tokenize(options: { preserveFormatting: true }): FormattingLexeme[];
    public tokenize(options?: TokenizeOptions): Lexeme[] | FormattingLexeme[];
    public tokenize(options?: TokenizeOptions): Lexeme[] | FormattingLexeme[] {
        if (options?.preserveFormatting) {
            return this.tokenizeWithFormatting();
        }
        
        // Create a fresh tokenizer instance for clean state
        const freshTokenizer = new SqlTokenizer(this.input);
        return freshTokenizer.readLexmes();
    }

    /**
     * Reads the lexemes from the input string.
     * 
     * @returns An array of lexemes extracted from the input string.
     * @throws Error if an unexpected character is encountered.
     */
    public readLexmes(): Lexeme[] {
        return this.tokenizeBasic();
    }

    /**
     * Tokenizes the input SQL without formatting preservation (internal method)
     */
    private tokenizeBasic(): Lexeme[] {
        // Reset position for this tokenization
        this.position = 0;
        
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

    /**
     * Tokenizes the input SQL while preserving formatting information
     */
    private tokenizeWithFormatting(): FormattingLexeme[] {
        // Get regular lexemes first
        const regularLexemes = this.tokenizeBasic();
        
        // Map regular lexemes to formatting lexemes with whitespace info
        return this.mapToFormattingLexemes(regularLexemes);
    }

    private mapToFormattingLexemes(regularLexemes: Lexeme[]): FormattingLexeme[] {
        if (regularLexemes.length === 0) {
            return [];
        }

        // First pass: find all lexeme positions in the input
        const lexemePositions: Array<{ startPosition: number; endPosition: number }> = [];
        let searchPos = 0;
        
        for (const lexeme of regularLexemes) {
            // Skip whitespace and comments
            searchPos = this.skipWhitespaceAndComments(searchPos);
            
            // Find lexeme at current position
            const lexemeInfo = this.findLexemeAtPosition(lexeme, searchPos);
            
            if (lexemeInfo) {
                lexemePositions.push(lexemeInfo);
                searchPos = lexemeInfo.endPosition;
            } else {
                // Fallback: assume lexeme length and continue
                const fallbackInfo = {
                    startPosition: searchPos,
                    endPosition: searchPos + lexeme.value.length
                };
                lexemePositions.push(fallbackInfo);
                searchPos = fallbackInfo.endPosition;
            }
        }
        
        // Second pass: build formatting lexemes with proper whitespace segments
        const formattingLexemes: FormattingLexeme[] = [];
        
        for (let i = 0; i < regularLexemes.length; i++) {
            const lexeme = regularLexemes[i];
            const lexemeInfo = lexemePositions[i];
            
            // Determine the end position of the whitespace segment
            const nextLexemeStartPos = i < regularLexemes.length - 1 
                ? lexemePositions[i + 1].startPosition 
                : this.input.length;
            
            // Extract whitespace between this lexeme and the next
            const whitespaceSegment = this.input.slice(lexemeInfo.endPosition, nextLexemeStartPos);
            const inlineComments = this.extractCommentsFromWhitespace(whitespaceSegment);

            const formattingLexeme: FormattingLexeme = {
                ...lexeme,
                followingWhitespace: whitespaceSegment,
                inlineComments,
                position: {
                    startPosition: lexemeInfo.startPosition,
                    endPosition: lexemeInfo.endPosition,
                    ...this.getLineColumnInfo(lexemeInfo.startPosition, lexemeInfo.endPosition)
                }
            };

            formattingLexemes.push(formattingLexeme);
        }

        return formattingLexemes;
    }

    /**
     * Find lexeme at a specific position, handling case variations
     */
    private findLexemeAtPosition(lexeme: Lexeme, expectedPos: number): { startPosition: number; endPosition: number } | null {
        if (expectedPos >= this.input.length) {
            return null;
        }
        
        // For command tokens (keywords), the lexeme.value might be lowercase but appear uppercase in input
        const valuesToTry = [lexeme.value, lexeme.value.toUpperCase(), lexeme.value.toLowerCase()];
        
        for (const valueToTry of valuesToTry) {
            // Check if the input at expected position matches this value
            if (expectedPos + valueToTry.length <= this.input.length &&
                this.input.substring(expectedPos, expectedPos + valueToTry.length) === valueToTry &&
                this.isValidLexemeMatch(valueToTry, expectedPos)) {
                return {
                    startPosition: expectedPos,
                    endPosition: expectedPos + valueToTry.length
                };
            }
        }

        return null;
    }

    private isValidLexemeMatch(value: string, position: number): boolean {
        // Check character before
        if (position > 0) {
            const charBefore = this.input[position - 1];
            if (this.isAlphanumericUnderscore(charBefore)) {
                return false; // Part of another identifier
            }
        }

        // Check character after
        const endPosition = position + value.length;
        if (endPosition < this.input.length) {
            const charAfter = this.input[endPosition];
            if (this.isAlphanumericUnderscore(charAfter)) {
                return false; // Part of another identifier
            }
        }

        return true;
    }

    /**
     * Check if character is alphanumeric or underscore (faster than regex)
     */
    private isAlphanumericUnderscore(char: string): boolean {
        const code = char.charCodeAt(0);
        return (code >= 48 && code <= 57) ||   // 0-9
               (code >= 65 && code <= 90) ||   // A-Z  
               (code >= 97 && code <= 122) ||  // a-z
               code === 95;                    // _
    }

    /**
     * Check if character is whitespace (faster than regex)
     */
    private isWhitespace(char: string): boolean {
        const code = char.charCodeAt(0);
        return code === 32 ||  // space
               code === 9 ||   // tab
               code === 10 ||  // \n
               code === 13;    // \r
    }

    private extractCommentsFromWhitespace(whitespaceSegment: string): string[] {
        const inlineComments: string[] = [];
        let pos = 0;
        
        while (pos < whitespaceSegment.length) {
            const oldPos = pos;
            
            // Try to extract comments using StringUtils
            const result = StringUtils.readWhiteSpaceAndComment(whitespaceSegment, pos);
            
            // Add any comments found
            if (result.lines.length > 0) {
                inlineComments.push(...result.lines);
            }
            
            // Move position forward
            pos = result.position;
            
            // Prevent infinite loop - if position didn't advance, manually skip one character
            if (pos === oldPos) {
                pos++;
            }
        }

        return inlineComments;
    }

    /**
     * Skip whitespace and comments from the given position
     */
    private skipWhitespaceAndComments(pos: number): number {
        let currentPos = pos;
        
        while (currentPos < this.input.length) {
            const char = this.input[currentPos];
            
            // Skip whitespace
            if (this.isWhitespace(char)) {
                currentPos++;
                continue;
            }
            
            // Skip line comments
            if (currentPos < this.input.length - 1 && 
                this.input[currentPos] === '-' && this.input[currentPos + 1] === '-') {
                // Find end of line or end of input
                while (currentPos < this.input.length && 
                       this.input[currentPos] !== '\n' && this.input[currentPos] !== '\r') {
                    currentPos++;
                }
                continue;
            }
            
            // Skip block comments
            if (currentPos < this.input.length - 1 && 
                this.input[currentPos] === '/' && this.input[currentPos + 1] === '*') {
                currentPos += 2;
                // Find end of comment
                while (currentPos < this.input.length - 1) {
                    if (this.input[currentPos] === '*' && this.input[currentPos + 1] === '/') {
                        currentPos += 2;
                        break;
                    }
                    currentPos++;
                }
                continue;
            }
            
            // No more whitespace or comments
            break;
        }
        
        return currentPos;
    }

    private getLineColumnInfo(startPos: number, endPos: number) {
        const startInfo = this.getLineColumn(startPos);
        const endInfo = this.getLineColumn(endPos);
        
        return {
            startLine: startInfo.line,
            startColumn: startInfo.column,
            endLine: endInfo.line,
            endColumn: endInfo.column
        };
    }

    private getLineColumn(position: number): { line: number; column: number } {
        let line = 1;
        let column = 1;

        for (let i = 0; i < Math.min(position, this.input.length); i++) {
            if (this.input[i] === '\n') {
                line++;
                column = 1;
            } else {
                column++;
            }
        }

        return { line, column };
    }
}
