import { SqlPrintToken, SqlPrintTokenType } from "../models/SqlPrintToken";

/**
 * Represents a single line in the pretty-printed SQL output.
 */
export class SqlPrintLine {
    /** Indentation level for this line */
    level: number;
    /** Text content of the line */
    text: string;

    constructor(level: number, text: string) {
        this.level = level;
        this.text = text;
    }
}

/**
 * CommaBreakStyle determines how commas are placed in formatted SQL output.
 * - 'none': No line break for commas
 * - 'before': Line break before comma
 * - 'after': Line break after comma
 */
export type CommaBreakStyle = 'none' | 'before' | 'after';

/**
 * AndBreakStyle determines how AND operators are placed in formatted SQL output.
 * - 'none': No line break for AND
 * - 'before': Line break before AND
 * - 'after': Line break after AND
 */
export type AndBreakStyle = 'none' | 'before' | 'after';


/**
 * SqlPrinter formats a SqlPrintToken tree into a SQL string with flexible style options.
 */
export class SqlPrinter {
    /** Indent character (e.g., ' ' or '\t') */
    indentChar: string;
    /** Indent size (number of indentChar repetitions per level) */
    indentSize: number;
    /** Newline character (e.g., '\n' or '\r\n') */
    newline: string;
    /** Comma break style: 'none', 'before', or 'after' */
    commaBreak: CommaBreakStyle;
    /** AND break style: 'none', 'before', or 'after' */
    andBreak: AndBreakStyle;

    /** Keyword case style: 'none', 'upper', or 'lower' */
    keywordCase: 'none' | 'upper' | 'lower';

    /**
     * @param options Optional style settings for pretty printing
     */
    constructor(options?: {
        indentChar?: string;
        indentSize?: number;
        newline?: string;
        commaBreak?: CommaBreakStyle;
        andBreak?: AndBreakStyle;
        keywordCase?: 'none' | 'upper' | 'lower';
    }) {
        this.indentChar = options?.indentChar ?? ' ';
        this.indentSize = options?.indentSize ?? 0;
        this.newline = options?.newline ?? '';
        this.commaBreak = options?.commaBreak ?? 'none';
        this.andBreak = options?.andBreak ?? 'none';
        this.keywordCase = options?.keywordCase ?? 'none';
    }

    /**
     * Converts a SqlPrintToken tree to a formatted SQL string.
     * @param token The root SqlPrintToken
     * @param level Indentation level (default: 0)
     */
    /**
     * Stores the lines generated during pretty printing.
     */
    lines: SqlPrintLine[] = [];

    /**
     * Converts a SqlPrintToken tree to a formatted SQL string.
     * @param token The root SqlPrintToken
     * @param level Indentation level (default: 0)
     */
    print(token: SqlPrintToken, level: number = 0): string {
        this.lines = [];
        this.appendLine(token, level, '');
        return this.lines.map(line => this.indent(line.level) + line.text).join(this.newline).trim();
    }

    private appendLine(token: SqlPrintToken, level: number, prefix: string) {
        if (!token.innerTokens || token.innerTokens.length === 0) {
            if (token.text === '') {
                return;
            }
        }

        let nextPrefix: string = '';
        if (token.type === SqlPrintTokenType.keyword) {
            let text = token.text;
            if (this.keywordCase === 'upper') {
                text = text.toUpperCase();
            } else if (this.keywordCase === 'lower') {
                text = text.toLowerCase();
            }
            this.lines.push(new SqlPrintLine(level, prefix + text));
        } else if (token.type === SqlPrintTokenType.commna) {
            if (this.commaBreak === 'before') {
                nextPrefix = token.text + ' ';
            } else {
                // 直前行に挿入
                if (this.lines.length > 0) {
                    this.lines[this.lines.length - 1].text += prefix + token.text;
                }
            }
        } else if (token.type === SqlPrintTokenType.operator && token.text.toLowerCase() === 'and') {
            if (this.andBreak === 'before') {
                nextPrefix = token.text + ' ';
            } else {
                // 直前行に挿入
                if (this.lines.length > 0) {
                    this.lines[this.lines.length - 1].text += prefix + token.text;
                }
            }
        } else {
            this.lines.push(new SqlPrintLine(level, prefix + token.text));
        }

        for (let i = 0; i < token.innerTokens.length; i++) {
            const child = token.innerTokens[i];
            this.appendLine(child, level, nextPrefix);
        }
    }

    /**
     * Returns the indent string for a given level.
     */
    private indent(level: number): string {
        return this.indentChar.repeat(this.indentSize * level);
    }
}
