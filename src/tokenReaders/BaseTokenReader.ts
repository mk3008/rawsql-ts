import { Lexeme, TokenType } from '../models/Lexeme';
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

        if (this.input[this.position] !== expectChar) {
            throw new Error(`Unexpected character. expect: ${expectChar}, actual: ${this.input[this.position]}, position: ${this.position}`);
        }

        const char = this.input[this.position];
        this.position++;
        return char;
    }

    /**
     * Create a lexeme with the specified type and value
     */
    protected createLexeme(type: TokenType, value: string, comments: string[] | null = null): Lexeme {
        if (type === TokenType.Command || type === TokenType.Operator || type === TokenType.Function) {
            return {
                type,
                value: value.toLowerCase(),
                comments: comments,
            };
        }
        return {
            type,
            value,
            comments: comments,
        };
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
