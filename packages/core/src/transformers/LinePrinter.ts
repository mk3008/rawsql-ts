// Define the allowed newline options
export type NewlineLogicalName = 'lf' | 'crlf' | 'cr';
export type NewlineOption = NewlineLogicalName | '\n' | '\r\n' | '\r' | ' ';

// Define the allowed indent character options
export type IndentCharLogicalName = 'space' | 'tab';
export type IndentCharOption = IndentCharLogicalName | string;

// Import CommaBreakStyle type
export type CommaBreakStyle = 'none' | 'before' | 'after';

/**
 * SqlPrintHelper provides utility methods for SQL pretty printing.
 */
export class LinePrinter {
    indentChar: IndentCharOption; // Changed type to IndentCharOption
    indentSize: number;
    newline: NewlineOption; // Changed type to NewlineOption
    commaBreak: CommaBreakStyle; // Add comma break style
    lines: PrintLine[];
    /**
     * @param indentChar Character used for indentation (default: ' ') // Accepts logical names like 'space'/'tab'
     * @param indentSize Number of indentChar per level (default: 0)
     * @param newline Newline string (default: '\r\n') // Accepts logical names like 'lf'/'crlf'/'cr'
     * @param commaBreak Comma break style (default: 'none')
     */
    constructor(indentChar: IndentCharOption = ' ', indentSize: number = 0, newline: NewlineOption = '\r\n', commaBreak: CommaBreakStyle = 'none') { // Changed type for indentChar
        this.indentChar = indentChar;
        this.indentSize = indentSize;
        this.newline = newline;
        this.commaBreak = commaBreak;
        this.lines = [];
        this.appendNewline(0);
    }

    public print(): string {
        let result = '';
        for (const line of this.lines) {
            if (line.text !== '') {
                // append indent and text
                result += this.indent(line.level) + line.text;
            }
        }
        return result.trimEnd();
    }

    /**
     * Returns the indent string for a given level.
     * @param level Indentation level
     */
    private indent(level: number): string {
        return this.indentChar.repeat(this.indentSize * level);
    }

    /**
     * Appends a newline token to the given tokens array if newline is set, or adds an empty line if tokens is empty.
     * @param tokens Array of token objects with 'level' and 'text' property
     * @param level Indentation level
     */
    appendNewline(level: number): void {
        if (this.lines.length > 0) {
            const current = this.lines[this.lines.length - 1];
            if (current.text !== '') {
                current.text = current.text.trimEnd() + this.newline;
            }
        }
        this.lines.push(new PrintLine(level, ''));
    }

    /**
     * Appends text to the last element of tokens array.
     * @param tokens Array of token objects with 'text' property
     * @param text Text to append
     */
    appendText(text: string): void {
        // Handle special comma cleanup first
        if (this.cleanupLine(text)) {
            // If cleanup was performed, add comma to previous line
            const previousLine = this.lines[this.lines.length - 1];
            previousLine.text = previousLine.text.trimEnd() + text;
            return;
        }

        const workLine = this.getCurrentLine();
        // Leading space is not needed
        if (!(text === ' ' && workLine.text === '')) {
            workLine.text += text;
        }
    }

    /**
     * Cleans up the current line for comma formatting.
     * For 'after' and 'none' comma styles, removes empty line when a comma is being added.
     * @param text The text being processed
     * @returns true if cleanup was performed, false otherwise
     */
    cleanupLine(text: string): boolean {
        const workLine = this.getCurrentLine();
        if (text === ',' && workLine.text.trim() === '' && this.lines.length > 1 && (this.commaBreak === 'after' || this.commaBreak === 'none')) {
            let previousIndex = this.lines.length - 2;
            while (previousIndex >= 0 && this.lines[previousIndex].text.trim() === '') {
                this.lines.splice(previousIndex, 1);
                previousIndex--;
            }
            if (previousIndex < 0) {
                return false;
            }
            const previousLine = this.lines[previousIndex];
            // Avoid pulling commas onto a line comment to keep the comma executable
            if (this.lineHasTrailingComment(previousLine.text)) {
                return false;
            }
            this.lines.pop(); // Safe: we checked lines.length > 1
            return true; // Cleanup performed
        }
        return false; // No cleanup needed
    }

    private lineHasTrailingComment(text: string): boolean {
        // Strip simple quoted sections so comment markers inside literals are ignored.
        const withoutStrings = text
            .replace(/'([^']|'')*'/g, '')
            .replace(/"([^"]|"")*"/g, '')
            .trim();
        // Treat any remaining '--' as a line comment marker so we never pull commas onto commented lines.
        return withoutStrings.includes('--');
    }

    getCurrentLine(): PrintLine {
        if (this.lines.length > 0) {
            return this.lines[this.lines.length - 1];
        } else {
            throw new Error('No tokens to get current line from.');
        }
    }

    /**
     * Checks if the current line is empty (has no text content)
     * @returns true if current line is empty, false otherwise
     */
    isCurrentLineEmpty(): boolean {
        if (this.lines.length > 0) {
            const currentLine = this.lines[this.lines.length - 1];
            return currentLine.text.trim() === '';
        }
        return true;
    }
}

export class PrintLine {
    level: number;
    text: string;

    constructor(level: number, text: string) {
        this.level = level;
        this.text = text;
    }
}
