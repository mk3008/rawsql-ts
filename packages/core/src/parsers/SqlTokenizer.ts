import { FormattingLexeme } from '../models/FormattingLexeme';
import { Lexeme, LexemePositionedComment, TokenType } from '../models/Lexeme';
import { CommandTokenReader } from '../tokenReaders/CommandTokenReader';
import { EscapedIdentifierTokenReader } from '../tokenReaders/EscapedIdentifierTokenReader';
import { FunctionTokenReader } from '../tokenReaders/FunctionTokenReader';
import { IdentifierTokenReader } from '../tokenReaders/IdentifierTokenReader';
import { LiteralTokenReader } from '../tokenReaders/LiteralTokenReader';
import { OperatorTokenReader } from '../tokenReaders/OperatorTokenReader';
import { ParameterTokenReader } from '../tokenReaders/ParameterTokenReader';
import { SpecialSymbolTokenReader } from '../tokenReaders/SymbolTokenReader';
import { StringSpecifierTokenReader } from '../tokenReaders/StringSpecifierTokenReader';
import { TokenReaderManager } from '../tokenReaders/TokenReaderManager';
import { TypeTokenReader } from '../tokenReaders/TypeTokenReader';
import { StringUtils } from '../utils/stringUtils';

/**
 * Options for tokenization behavior
 */
export interface TokenizeOptions {
    preserveFormatting?: boolean;
}

export interface StatementLexemeResult {
    lexemes: Lexeme[];
    statementStart: number;
    statementEnd: number;
    nextPosition: number;
    rawText: string;
    leadingComments: string[] | null;
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
     * Cached start offsets for each line in the input string.
     */
    private lineStartPositions: number[] | null = null;

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
        return freshTokenizer.readLexemes();
    }

    /**
     * @deprecated Use {@link readLexemes} (correct spelling) instead.
     * This legacy alias remains for backwards compatibility and delegates to the new method.
     */
    public readLexmes(): Lexeme[] {
        return this.readLexemes();
    }

    /**
     * Reads the lexemes from the input string.
     * 
     * @returns An array of lexemes extracted from the input string.
     * @throws Error if an unexpected character is encountered.
     */
    public readLexemes(): Lexeme[] {
        const segment = this.readNextStatement(0);
        return segment ? segment.lexemes : [];
    }

    /**
     * Tokenizes the input SQL without formatting preservation (internal method)
     */
    private tokenizeBasic(): Lexeme[] {
        const segment = this.readNextStatement(0);
        return segment ? segment.lexemes : [];
    }

    public readNextStatement(startPosition: number = 0, carryComments: string[] | null = null): StatementLexemeResult | null {
        const length = this.input.length;

        // Abort when the cursor already moved past the input.
        if (startPosition >= length) {
            return null;
        }

        // Adopt a working cursor so the original tokenizer state is untouched.
        this.position = startPosition;

        const statementStart = startPosition;
        let pendingLeading = carryComments ? [...carryComments] : null;
        const tokenData: Array<{
            lexeme: Lexeme;
            startPos: number;
            endPos: number;
            prefixComments: string[] | null;
            suffixComments: string[] | null;
        }> = [];

        let previous: Lexeme | null = null;

        while (this.canRead()) {
            // Fold whitespace and comments into the token stream and advance to the next significant character.
            const prefixComment = this.readComment();
            this.position = prefixComment.position;

            if (!this.canRead()) {
                // No more characters, so keep any trailing comments for the next statement.
                pendingLeading = this.mergeComments(pendingLeading, prefixComment.lines);
                break;
            }

            if (this.input[this.position] === ';') {
                // Statement terminated before any token appeared.
                pendingLeading = this.mergeComments(pendingLeading, prefixComment.lines);
                break;
            }

            // Read the next lexeme at the current position.
            const lexeme = this.readerManager.tryRead(this.position, previous);
            if (lexeme === null) {
                throw new Error(`Unexpected character. actual: ${this.input[this.position]}, position: ${this.position}\n${this.getDebugPositionInfo(this.position)}`);
            }

            const tokenStartPos = this.position;
            const tokenEndPos = this.position = this.readerManager.getMaxPosition();

            // Capture trailing whitespace and comments after the token.
            const suffixComment = this.readComment();
            this.position = suffixComment.position;

            let prefixComments = this.mergeComments(pendingLeading, prefixComment.lines);
            pendingLeading = null;

            tokenData.push({
                lexeme,
                startPos: tokenStartPos,
                endPos: tokenEndPos,
                prefixComments,
                suffixComments: suffixComment.lines
            });

            previous = lexeme;
        }

        const statementEnd = this.position;
        const lexemes = this.buildLexemesFromTokenData(tokenData);
        const nextPosition = this.skipPastTerminator(statementEnd);

        return {
            lexemes,
            statementStart,
            statementEnd,
            nextPosition,
            rawText: this.input.slice(statementStart, statementEnd),
            leadingComments: pendingLeading
        };
    }

    private buildLexemesFromTokenData(tokenData: Array<{
        lexeme: Lexeme;
        startPos: number;
        endPos: number;
        prefixComments: string[] | null;
        suffixComments: string[] | null;
    }>): Lexeme[] {
        const lexemes: Lexeme[] = new Array(tokenData.length);

        for (let i = 0; i < tokenData.length; i++) {
            const current = tokenData[i];
            const lexeme = current.lexeme;

            // Redirect SELECT suffix comments to the first meaningful select item.
            if (lexeme.value.toLowerCase() === 'select' && current.suffixComments && current.suffixComments.length > 0) {
                const suffixComments = current.suffixComments;
                let targetIndex = i + 1;
                while (targetIndex < tokenData.length) {
                    const target = tokenData[targetIndex];
                    // Allow SELECT-prefix comments to bind to '*' tokens so they stay with the select list.
                    const isStarOperator = (target.lexeme.type & TokenType.Operator) && target.lexeme.value === '*';
                    if ((target.lexeme.type & TokenType.Identifier) ||
                        (target.lexeme.type & TokenType.Literal) ||
                        isStarOperator ||
                        (!(target.lexeme.type & TokenType.Command) &&
                         !(target.lexeme.type & TokenType.Comma) &&
                         !(target.lexeme.type & TokenType.Operator))) {
                        if (!target.prefixComments) {
                            target.prefixComments = [];
                        }
                        target.prefixComments.unshift(...suffixComments);
                        current.suffixComments = null;
                        break;
                    }
                    targetIndex++;
                }
            }

            if (lexeme.value.toLowerCase() === 'from' && current.suffixComments && current.suffixComments.length > 0) {
                const suffixComments = current.suffixComments;
                let targetIndex = i + 1;
                while (targetIndex < tokenData.length) {
                    const target = tokenData[targetIndex];
                    // Attach FROM suffix comments to the immediately following source token.
                    const isCommand = (target.lexeme.type & TokenType.Command) !== 0;
                    if (!isCommand) {
                        if (!target.prefixComments) {
                            target.prefixComments = [];
                        }
                        target.prefixComments.unshift(...suffixComments);
                        current.suffixComments = null;
                        break;
                    }
                    targetIndex++;
                }
            }

            // Ensure commas push trailing comments onto the following token.
            if ((lexeme.type & TokenType.Comma) && current.suffixComments && current.suffixComments.length > 0) {
                const suffixComments = current.suffixComments;
                let targetIndex = i + 1;
                if (targetIndex < tokenData.length) {
                    const target = tokenData[targetIndex];
                    if (!target.prefixComments) {
                        target.prefixComments = [];
                    }
                    target.prefixComments.unshift(...suffixComments);
                    current.suffixComments = null;
                }
            }

            // Bridge set-operator suffix comments to the subsequent SELECT clause.
            if ((lexeme.value.toLowerCase() === 'union' ||
                 lexeme.value.toLowerCase() === 'intersect' ||
                 lexeme.value.toLowerCase() === 'except') &&
                current.suffixComments && current.suffixComments.length > 0) {
                const suffixComments = current.suffixComments;
                let targetIndex = i + 1;
                while (targetIndex < tokenData.length) {
                    const target = tokenData[targetIndex];
                    if (target.lexeme.value.toLowerCase() === 'select') {
                        if (!target.prefixComments) {
                            target.prefixComments = [];
                        }
                        target.prefixComments.unshift(...suffixComments);
                        current.suffixComments = null;
                        break;
                    }
                    targetIndex++;
                }
            }

            this.attachCommentsToLexeme(lexeme, current);
            // Attach source position metadata so downstream parsers can report precise locations.
            lexeme.position = {
                startPosition: current.startPos,
                endPosition: current.endPos,
                ...this.getLineColumnInfo(current.startPos, current.endPos)
            };
            lexemes[i] = lexeme;
        }

        this.relocateOrderByComments(lexemes);
        return lexemes;
    }

    private skipPastTerminator(position: number): number {
        let next = position;

        if (next < this.input.length && this.input[next] === ';') {
            next++;
        }

        return this.skipWhitespaceAndComments(next);
    }

    private mergeComments(base: string[] | null, addition: string[] | null | undefined): string[] | null {
        if (addition && addition.length > 0) {
            if (!base || base.length === 0) {
                return [...addition];
            }
            return [...base, ...addition];
        }

        return base ? [...base] : null;
    }

    private relocateOrderByComments(lexemes: Lexeme[]): void {
        // Move ORDER BY trailing comments onto the next token so the following expression inherits them.
        for (let i = 0; i < lexemes.length - 1; i++) {
            const current = lexemes[i];
            if (current.value.toLowerCase() !== 'order by' || !current.positionedComments) {
                continue;
            }

            // Gather only the trailing comment sets that should move with the clause.
            const afterComments = current.positionedComments.filter(comment => comment.position === 'after' && comment.comments && comment.comments.length > 0);
            if (afterComments.length === 0) {
                continue;
            }

            // Strip the relocated comments from the ORDER BY token so duplicates do not remain.
            current.positionedComments = current.positionedComments.filter(comment => comment.position !== 'after');
            if (current.positionedComments.length === 0) {
                current.positionedComments = undefined;
            }

            const target = lexemes[i + 1];
            // Convert trailing comments into before-positioned comments for the next expression.
            const beforeComments: LexemePositionedComment[] = afterComments.map(comment => ({
                position: 'before',
                comments: [...comment.comments],
            }));

            // Prepend the relocated comments so they remain adjacent to the next lexeme.
            if (target.positionedComments && target.positionedComments.length > 0) {
                target.positionedComments = [...beforeComments, ...target.positionedComments];
            } else {
                target.positionedComments = beforeComments;
            }
        }
    }

    // Attach comments to lexeme directly (no collection then assignment anti-pattern)
    private attachCommentsToLexeme(lexeme: Lexeme, tokenData: { prefixComments: string[] | null; suffixComments: string[] | null }): void {
        const newPositionedComments: { position: 'before' | 'after'; comments: string[] }[] = [];
        const allLegacyComments: string[] = [];

        // Preserve existing positioned comments from token readers (e.g., CommandTokenReader)
        if (lexeme.positionedComments && lexeme.positionedComments.length > 0) {
            newPositionedComments.push(...lexeme.positionedComments);
        }

        // Add prefix comments as "before" positioned comments directly
        if (tokenData.prefixComments && tokenData.prefixComments.length > 0) {
            allLegacyComments.push(...tokenData.prefixComments);
            newPositionedComments.push({
                position: 'before',
                comments: [...tokenData.prefixComments]
            });
        }

        // Add suffix comments as "after" positioned comments directly
        if (tokenData.suffixComments && tokenData.suffixComments.length > 0) {
            allLegacyComments.push(...tokenData.suffixComments);
            newPositionedComments.push({
                position: 'after',
                comments: [...tokenData.suffixComments]
            });
        }

        // Apply comments directly to lexeme (positioned comments take priority)
        if (newPositionedComments.length > 0) {
            lexeme.positionedComments = newPositionedComments;
            // Clear legacy comments when positioned comments exist to avoid duplication
            lexeme.comments = null;
        } else if (allLegacyComments.length > 0) {
            // Only set legacy comments if no positioned comments exist
            lexeme.comments = allLegacyComments;
            lexeme.positionedComments = undefined;
        } else {
            // Clear both if no comments exist
            lexeme.comments = null;
            lexeme.positionedComments = undefined;
        }
    }

    /**
     * Skips whitespace characters and SQL comments in the input.
     * 
     * @remarks This method updates the position pointer.
     */
    private readComment(): { position: number, lines: string[] | null } {
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
            const lines = result.lines;
            if (lines && lines.length > 0) {
                inlineComments.push(...lines);
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
        return StringUtils.readWhiteSpaceAndComment(this.input, pos).position;
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
        const starts = this.ensureLineStartPositions();

        // Use binary search to locate the greatest line start that does not exceed position.
        let low = 0;
        let high = starts.length - 1;
        while (low <= high) {
            const mid = (low + high) >>> 1;
            if (starts[mid] <= position) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        const lineIndex = high >= 0 ? high : 0;
        const lineStart = starts[lineIndex];
        return {
            line: lineIndex + 1,
            column: position - lineStart + 1
        };
    }

    private ensureLineStartPositions(): number[] {
        if (this.lineStartPositions) {
            return this.lineStartPositions;
        }

        const starts: number[] = [0];

        // Precompute the start index of each line so callers can map positions in O(log n).
        for (let i = 0; i < this.input.length; i++) {
            if (this.input.charCodeAt(i) === 10) { // '\n'
                starts.push(i + 1);
            }
        }

        this.lineStartPositions = starts;
        return starts;
    }
}







