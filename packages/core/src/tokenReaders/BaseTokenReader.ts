import { Lexeme, TokenType, LexemePosition } from '../models/Lexeme';
import { StringUtils } from '../utils/stringUtils';

/**
 * Base class for token readers
 */
export abstract class BaseTokenReader {
    protected input: string;
    protected position: number;

    constructor(input: string, position: number = 0) {
        this.input = input;
        this.position = position;
    }

    /**
     * Get the current position in the input
     */
    public getPosition(): number {
        return this.position;
    }

    /**
     * Set the position in the input
     */
    public setPosition(position: number): void {
        this.position = position;
    }

    /**
     * Check if we've reached the end of input
     */
    protected isEndOfInput(shift: number = 0): boolean {
        return this.position + shift >= this.input.length;
    }

    /**
     * Check if we can read more characters
     */
    protected canRead(shift: number = 0): boolean {
        return !this.isEndOfInput(shift);
    }

    /**
     * Read an expected character
     */
    protected read(expectChar: string): string {
        if (this.isEndOfInput()) {
            throw new Error(`Unexpected character. expect: ${expectChar}, actual: EndOfInput, position: ${this.position}`);
        }

        const char = this.input[this.position];
        if (char !== expectChar) {
            throw new Error(`Unexpected character. expect: ${expectChar}, actual: ${char}, position: ${this.position}`);
        }

        this.position++;
        return char;
    }

    /**
     * Create a lexeme with the specified type and value
     */
    protected createLexeme(type: TokenType, value: string, comments: string[] | null = null, startPosition?: number, endPosition?: number): Lexeme {
        const lexeme: Lexeme = {
            type,
            value: (type === TokenType.Command || type === TokenType.Operator || type === TokenType.Function) 
                ? value.toLowerCase() 
                : value,
            comments: comments,
        };

        // Add position information if provided
        if (startPosition !== undefined && endPosition !== undefined) {
            lexeme.position = {
                startPosition,
                endPosition,
            };
        }

        return lexeme;
    }

    /**
     * Create a lexeme with automatic position tracking
     */
    protected createLexemeWithPosition(type: TokenType, value: string, startPos: number, comments: string[] | null = null): Lexeme {
        return this.createLexeme(type, value, comments, startPos, startPos + value.length);
    }

    /**
     * Get debug info for error reporting
     */
    protected getDebugPositionInfo(errPosition: number): string {
        return StringUtils.getDebugPositionInfo(this.input, errPosition);
    }

    /**
     * Try to read a token from the current position
     * @param previous The previous token, if available
     * @returns The read token or null if no token could be read
     */
    public abstract tryRead(previous: Lexeme | null): Lexeme | null;
}
