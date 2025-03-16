import { CharLookupTable } from "./charLookupTable";

/**
 * Utilities for string operations during tokenization
 */
export class StringUtils {
    /**
     * Creates a visual representation of an error position in text
     * @param input The input text
     * @param errPosition The error position
     * @returns A string with a caret pointing to the error position
     */
    public static getDebugPositionInfo(input: string, errPosition: number): string {
        // Get 5 characters before and after the error
        // If the start and end points are out of the string range, keep them within the range
        // Display ^ at the error position on the next line
        const start = Math.max(0, errPosition - 5);
        const end = Math.min(input.length, errPosition + 5);
        const debugInfo = input.slice(start, end);
        const caret = ' '.repeat(errPosition - start) + '^';
        return `${debugInfo}\n${caret}`;
    }

    /**
     * Skip white space characters.
     */
    private static skipWhiteSpace(input: string, position: number): number {
        const start = position;
        const whitespace = new Set([' ', '\r', '\n', '\t']);
        while (position < input.length) {
            if (!whitespace.has(input[position])) {
                break;
            }
            position++;
        }
        return position;
    }

    /**
     * Skip line comment.
     */
    private static skipLineComment(input: string, position: number): number {
        if (position + 1 >= input.length) {
            return position;
        }
        if (input[position] === '-' && input[position + 1] === '-') {
            position += 2;
            while (position < input.length && input[position] !== '\n') {
                position++;
            }
        }
        return position;
    }

    /**
     * Skip block comment.
     */
    private static skipBlockComment(input: string, position: number): number {
        if (position + 3 >= input.length) {
            return position;
        }
        if (input[position] === '/' && input[position + 1] === '*') {
            position += 2;
            while (position + 1 < input.length) {
                if (input[position] === '*' && input[position + 1] === '/') {
                    position += 2;
                    return position;
                }
                position++;
            }
            throw new Error(`Block comment is not closed. position: ${position}`);
        }
        return position;
    }

    /**
     * Skip white space characters and SQL comments.
     */
    public static skipWhiteSpacesAndComments(input: string, position: number): number {
        while (true) {
            const newPosition = StringUtils.skipWhiteSpace(input, position);
            if (newPosition !== position) {
                position = newPosition;
                continue;
            }
            const newLineCommentPosition = StringUtils.skipLineComment(input, position);
            if (newLineCommentPosition !== position) {
                position = newLineCommentPosition;
                continue;
            }
            const newBlockCommentPosition = StringUtils.skipBlockComment(input, position);
            if (newBlockCommentPosition !== position) {
                position = newBlockCommentPosition;
                continue;
            }
            break;
        }
        return position;
    }

    /**
     * Read a regular identifier.
     */
    public static readRegularIdentifier(input: string, position: number): { identifier: string, newPosition: number } {
        const result = this.tryReadRegularIdentifier(input, position);

        if (!result) {
            throw new Error(`Unexpected character. position: ${position}\n${StringUtils.getDebugPositionInfo(input, position)}`);
        }

        return result;
    }

    public static tryReadRegularIdentifier(input: string, position: number): { identifier: string, newPosition: number } | null{
        const start = position;

        while (position < input.length) {
            if (CharLookupTable.isDelimiter(input[position])) {
                break;
            }
            position++;
        }

        if (start === position) {
            return null;
        }

        return {
            identifier: input.slice(start, position),
            newPosition: position
        };
    }
}
