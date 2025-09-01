import { LineColumn } from './LexemeCursor';

/**
 * Utility functions for text position conversion and manipulation
 * 
 * Provides centralized functionality for converting between different
 * position representations commonly used in text processing and SQL parsing.
 */
export class TextPositionUtils {
    /**
     * Convert line/column position to character offset
     * 
     * @param text - Source text
     * @param position - Line/column position (1-based)
     * @returns Character offset (0-based) or -1 if invalid
     * 
     * @example
     * ```typescript
     * const text = "SELECT id\nFROM users";
     * const charOffset = TextPositionUtils.lineColumnToCharOffset(text, { line: 2, column: 1 });
     * console.log(charOffset); // 10 (position of 'F' in 'FROM')
     * ```
     */
    public static lineColumnToCharOffset(text: string, position: LineColumn): number {
        if (position.line < 1 || position.column < 1) {
            return -1;
        }
        
        const lines = text.split('\n');
        
        if (position.line > lines.length) {
            return -1;
        }
        
        const targetLine = lines[position.line - 1];
        if (position.column > targetLine.length + 1) {
            return -1;
        }
        
        let offset = 0;
        for (let i = 0; i < position.line - 1; i++) {
            offset += lines[i].length + 1; // +1 for newline
        }
        offset += position.column - 1;
        
        return offset;
    }

    /**
     * Convert character offset to line/column position
     * 
     * @param text - Source text
     * @param charOffset - Character offset (0-based)
     * @returns Line/column position (1-based) or null if invalid
     * 
     * @example
     * ```typescript
     * const text = "SELECT id\nFROM users";
     * const position = TextPositionUtils.charOffsetToLineColumn(text, 10);
     * console.log(position); // { line: 2, column: 1 }
     * ```
     */
    public static charOffsetToLineColumn(text: string, charOffset: number): LineColumn | null {
        if (charOffset < 0 || charOffset > text.length) {
            return null;
        }
        
        const lines = text.split('\n');
        let currentOffset = 0;
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const lineLength = lines[lineIndex].length;
            
            if (charOffset < currentOffset + lineLength) {
                return {
                    line: lineIndex + 1,
                    column: charOffset - currentOffset + 1
                };
            }
            
            if (charOffset === currentOffset + lineLength && lineIndex < lines.length - 1) {
                return {
                    line: lineIndex + 2,
                    column: 1
                };
            }
            
            currentOffset += lineLength + 1; // +1 for newline
        }
        
        // Handle position at very end
        if (charOffset === text.length) {
            const lastLine = lines[lines.length - 1];
            return {
                line: lines.length,
                column: lastLine.length + 1
            };
        }
        
        return null;
    }

    /**
     * Check if a position is within text bounds
     * 
     * @param text - Source text
     * @param position - Line/column position (1-based)
     * @returns True if position is valid
     */
    public static isValidPosition(text: string, position: LineColumn): boolean {
        return this.lineColumnToCharOffset(text, position) !== -1;
    }

    /**
     * Get the line at the specified line number
     * 
     * @param text - Source text
     * @param lineNumber - Line number (1-based)
     * @returns Line content or null if invalid
     */
    public static getLine(text: string, lineNumber: number): string | null {
        if (lineNumber < 1) {
            return null;
        }
        
        const lines = text.split('\n');
        if (lineNumber > lines.length) {
            return null;
        }
        
        return lines[lineNumber - 1];
    }

    /**
     * Get the total number of lines in text
     * 
     * @param text - Source text
     * @returns Number of lines
     */
    public static getLineCount(text: string): number {
        return text.split('\n').length;
    }
}