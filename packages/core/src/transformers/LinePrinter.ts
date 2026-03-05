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
                const lineText = this.endsWithAsciiWhitespace(current.text) ? current.text.trimEnd() : current.text;
                current.text = lineText + this.newline;
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
        // Handle special comma cleanup only when a comma token is appended.
        if (text === ',' && this.cleanupLine()) {
            // If cleanup was performed, add comma to previous line
            const previousLine = this.lines[this.lines.length - 1];
            const lineText = this.endsWithAsciiWhitespace(previousLine.text) ? previousLine.text.trimEnd() : previousLine.text;
            previousLine.text = lineText + text;
            return;
        }

        const workLine = this.getCurrentLine();
        // Leading space is not needed
        if (!(text === ' ' && workLine.text === '')) {
            workLine.text += text;
        }
    }
    private endsWithAsciiWhitespace(text: string): boolean {
        if (text.length === 0) {
            return false;
        }

        const tail = text.charCodeAt(text.length - 1);
        return tail === 32 || tail === 9 || tail === 10 || tail === 13;
    }
    trimTrailingWhitespaceFromPreviousLine(): void {
        if (this.lines.length < 2) {
            return;
        }
        const previousLine = this.lines[this.lines.length - 2];
        const newlineMatch = previousLine.text.match(/(\r?\n)$/);
        const trailingNewline = newlineMatch ? newlineMatch[1] : '';
        const content = trailingNewline
            ? previousLine.text.slice(0, -trailingNewline.length)
            : previousLine.text;
        previousLine.text = content.replace(/[ \t]+$/, '') + trailingNewline;
    }

    /**
     * Cleans up the current line for comma formatting.
     * For 'after' and 'none' comma styles, removes empty line when a comma is being added.
     * @returns true if cleanup was performed, false otherwise
     */
    cleanupLine(): boolean {
        const workLine = this.getCurrentLine();
        if (this.isAsciiWhitespaceOnly(workLine.text) && this.lines.length > 1 && (this.commaBreak === 'after' || this.commaBreak === 'none')) {
            let previousIndex = this.lines.length - 2;
            while (previousIndex >= 0 && this.isAsciiWhitespaceOnly(this.lines[previousIndex].text)) {
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


    private isAsciiWhitespaceOnly(text: string): boolean {
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            if (code !== 32 && code !== 9 && code !== 10 && code !== 13) {
                return false;
            }
        }
        return true;
    }

    private lineHasTrailingComment(text: string): boolean {
        if (!text.includes('--')) {
            return false;
        }

        if (!text.includes("'") && !text.includes('"')) {
            return true;
        }

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
            return this.isAsciiWhitespaceOnly(currentLine.text);
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

