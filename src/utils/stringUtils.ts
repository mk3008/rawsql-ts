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
}
