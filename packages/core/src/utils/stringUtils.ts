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
        const length = input.length;

        /*
         * Optimization: Try to skip 4 spaces at once (for 4-space indents).
         * This is effective when SQL is deeply nested and uses 4-space indentation.
         * In typical cases, charCodeAt in a loop is fastest, but for large/indented SQL,
         * this can reduce the number of iterations and improve stability (lower error/deviation in benchmarks).
         * If indentation is not 4 spaces, this check is skipped quickly, so overhead is minimal.
         *
         * Even for 2-space indents or mixed indents (2, 4, tab),
         * the remaining whitespace is handled by the following loop, so there is no performance loss.
         *
         * Benchmark results show that this optimization does not slow down short queries,
         * and can make long/indented queries more stable and slightly faster.
         */
        while (position + 4 <= length &&
               input.charCodeAt(position) === 32 &&
               input.charCodeAt(position + 1) === 32 &&
               input.charCodeAt(position + 2) === 32 &&
               input.charCodeAt(position + 3) === 32) {
            position += 4;
        }

        // Then skip remaining whitespace one by one (space, tab, newline, carriage return)
        while (position < length) {
            const charCode = input.charCodeAt(position);
            // ' '=32, '\t'=9, '\n'=10, '\r'=13
            if (charCode !== 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
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

        // '-'=45
        if (input.charCodeAt(position) === 45 && input.charCodeAt(position + 1) === 45) {
            const start = position;
            position += 2;

            // '\n'=10
            while (position < input.length && input.charCodeAt(position) !== 10) {
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
        if (position + 1 >= input.length) {
            return { newPosition: position, comments: null };
        }

        // Fast check for /* ('/'=47, '*'=42)
        if (input.charCodeAt(position) !== 47 || input.charCodeAt(position + 1) !== 42) {
            return { newPosition: position, comments: null };
        }

        // Treat Oracle style hints (/*+) as non-comment so other readers can process them. ('+'=43)
        const isHint = position + 2 < input.length && input.charCodeAt(position + 2) === 43;
        if (isHint) {
            return { newPosition: position, comments: null };
        }

        const start = position;
        position += 2;

        while (position + 1 < input.length) {
            // Look for closing */ ('*'/=42, '/'=47)
            if (input.charCodeAt(position) === 42 && input.charCodeAt(position + 1) === 47) {
                position += 2;
                const processedLines = this.processBlockCommentContent(input.slice(start + 2, position - 2));
                return { newPosition: position, comments: processedLines };
            }
            position++;
        }

        // Unterminated comment: consume rest of input and return collected lines.
        const processedLinesUnterminated = this.processBlockCommentContent(input.slice(start + 2));
        return { newPosition: input.length, comments: processedLinesUnterminated };
    }

    private static processBlockCommentContent(rawContent: string): string[] {
        const rawLines = rawContent.replace(/\r/g, '').split('\n');
        const processedLines: string[] = [];

        for (const rawLine of rawLines) {
            const trimmedLine = rawLine.trim();
            const isSeparatorLine = /^\s*[-=_+*#]+\s*$/.test(rawLine);

            if (trimmedLine !== '' || isSeparatorLine) {
                processedLines.push(isSeparatorLine ? rawLine.trim() : trimmedLine);
            } else {
                processedLines.push('');
            }
        }

        while (processedLines.length > 0 && processedLines[0] === '') {
            processedLines.shift();
        }
        while (processedLines.length > 0 && processedLines[processedLines.length - 1] === '') {
            processedLines.pop();
        }

        return processedLines;
    }

    /**
     * Skip white space characters and SQL comments.
     * @returns Object containing the new position and an array of skipped comments
     */
    public static readWhiteSpaceAndComment(input: string, position: number): { position: number, lines: string[] | null } {
        let lines: string[] | null = null;
        const length = input.length;

        while (position < length) {
            const oldPosition = position;
            position = StringUtils.skipWhiteSpace(input, position);
            if (position !== oldPosition) {
                continue;
            }

            const charCode = input.charCodeAt(position);

            // '--' line comment
            if (charCode === 45 && position + 1 < length && input.charCodeAt(position + 1) === 45) {
                const commentStart = position + 2;
                position = commentStart;

                while (position < length && input.charCodeAt(position) !== 10) {
                    position++;
                }

                const comment = input.slice(commentStart, position).trim();
                if (comment) {
                    if (lines === null) {
                        lines = [];
                    }
                    lines.push(comment);
                }
                continue;
            }

            // '/* ... */' block comment (excluding Oracle hint: /*+)
            if (charCode === 47 && position + 1 < length && input.charCodeAt(position + 1) === 42) {
                if (position + 2 < length && input.charCodeAt(position + 2) === 43) {
                    break;
                }

                const contentStart = position + 2;
                position = contentStart;
                let closed = false;

                while (position + 1 < length) {
                    if (input.charCodeAt(position) === 42 && input.charCodeAt(position + 1) === 47) {
                        const processedLines = this.processBlockCommentContent(input.slice(contentStart, position));
                        position += 2;
                        if (processedLines.length > 0) {
                            if (lines === null) {
                                lines = [];
                            }
                            lines.push(...processedLines);
                        }
                        closed = true;
                        break;
                    }
                    position++;
                }

                if (!closed) {
                    const processedLines = this.processBlockCommentContent(input.slice(contentStart));
                    if (processedLines.length > 0) {
                        if (lines === null) {
                            lines = [];
                        }
                        lines.push(...processedLines);
                    }
                    position = length;
                }
                continue;
            }

            break;
        }

        return { position, lines };
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
        const length = input.length;

        // Scan the identifier using char codes to avoid per-character string allocations.
        while (position < length) {
            if (CharLookupTable.isDelimiterCode(input.charCodeAt(position))) {
                break;
            }
            position++;
        }

        if (start === position) {
            return null;
        }

        // Check index range before checking for [] (array type)
        // But don't include [] if it looks like array access rather than type declaration
        while (
            position + 1 < input.length &&
            input[position] === '[' &&
            input[position + 1] === ']'
        ) {
            // Check if this looks like array access context by looking at what comes before
            // Array access context: after an expression/identifier that could be an array
            // Type context: in type declarations, parameter lists, etc.
            
            // Simple heuristic: if we're at the end of what looks like a variable/column name
            // and not in a clear type context, treat [] as array access, not type suffix
            const beforeIdentifier = input.slice(0, start).trim();
            
            // Don't treat as type suffix if:
            // 1. We're at the start of input (standalone identifier)
            // 2. Previous context suggests this is a variable/column reference
            if (beforeIdentifier === '' || 
                /[)]$/.test(beforeIdentifier) ||  // After closing paren 
                /\b(select|from|where|and|or|set|values|insert|update|delete)\s*$/i.test(beforeIdentifier)) {
                // This looks like array access context, don't include []
                break;
            }
            
            position += 2; // Skip the [] (keep existing behavior for type contexts)
        }

        return {
            identifier: input.slice(start, position),
            newPosition: position
        };
    }
}
