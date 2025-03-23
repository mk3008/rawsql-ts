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
    private static readLineComment(input: string, position: number): { newPosition: number, comment: string | null } {
        if (position + 1 >= input.length) {
            return { newPosition: position, comment: null };
        }
        if (input[position] === '-' && input[position + 1] === '-') {
            const start = position;
            position += 2;
            while (position < input.length && input[position] !== '\n') {
                position++;
            }

            // Return the trimmed comment content (excluding -- tokens)
            const comment = input.slice(start + 2, position).trim();
            return { newPosition: position, comment };
        }
        return { newPosition: position, comment: null };
    }

    /**
     * Skip block comment.
     */
    private static readBlockComment(input: string, position: number): { newPosition: number, comments: string[] | null } {
        if (position + 3 >= input.length) {
            return { newPosition: position, comments: null };
        }

        // Check for block comment start (/*) and not a special case (/*+)
        if (input[position] === '/' && input[position + 1] === '*' && input[position + 2] !== '+') {
            const start = position;
            position += 2;
            while (position + 1 < input.length) {
                if (input[position] === '*' && input[position + 1] === '/') {
                    position += 2;

                    // Return the trimmed comment content (excluding /* */ tokens)
                    const lines = input.slice(start + 2, position - 2).replace(/\r/g, '').split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        lines[i] = lines[i].trim();
                    }

                    // 空行はのぞく。ただし、のぞくのは、最初と最後だけ
                    while (lines.length > 0 && lines[0] === '') {
                        lines.shift();
                    }
                    while (lines.length > 0 && lines[lines.length - 1] === '') {
                        lines.pop();
                    }

                    return { newPosition: position, comments: lines };
                }
                position++;
            }
            throw new Error(`Block comment is not closed. position: ${position}`);
        }
        return { newPosition: position, comments: null };
    }

    /**
     * Skip white space characters and SQL comments.
     * @returns Object containing the new position and an array of skipped comments
     */
    public static readComments(input: string, position: number): { position: number, comments: string[] | null } {
        const comments: string[] = [];

        while (true) {
            const newPosition = StringUtils.skipWhiteSpace(input, position);
            if (newPosition !== position) {
                position = newPosition;
                continue;
            }

            const lineCommentResult = StringUtils.readLineComment(input, position);
            if (lineCommentResult.newPosition !== position) {
                position = lineCommentResult.newPosition;
                if (lineCommentResult.comment) {
                    comments.push(lineCommentResult.comment.trim());
                }
                continue;
            }

            const blockCommentResult = StringUtils.readBlockComment(input, position);
            if (blockCommentResult.newPosition !== position) {
                position = blockCommentResult.newPosition;
                if (blockCommentResult.comments) {
                    for (let i = 0; i < blockCommentResult.comments.length; i++) {
                        comments.push(blockCommentResult.comments[i].trim());
                    }
                }
                continue;
            }

            break;
        }

        if (comments.length > 0) {
            return { position, comments: comments };
        }
        return { position, comments: null };
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

    public static tryReadRegularIdentifier(input: string, position: number): { identifier: string, newPosition: number } | null {
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
