import { SqlPrintToken, SqlPrintTokenType, SqlPrintTokenContainerType } from "../models/SqlPrintToken";
import { IndentCharOption, LinePrinter, NewlineOption } from "./LinePrinter";
import { WithClauseStyle } from "./SqlFormatter";

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
 * Options for configuring SqlPrinter formatting behavior
 */
export interface SqlPrinterOptions {
    /** Indent character (e.g., ' ' or '\t') */
    indentChar?: IndentCharOption;
    /** Indent size (number of indentChar repetitions per level) */
    indentSize?: number;
    /** Newline character (e.g., '\n' or '\r\n') */
    newline?: NewlineOption;
    /** Comma break style: 'none', 'before', or 'after' */
    commaBreak?: CommaBreakStyle;
    /** AND break style: 'none', 'before', or 'after' */
    andBreak?: AndBreakStyle;
    /** Keyword case style: 'none', 'upper' | 'lower' */
    keywordCase?: 'none' | 'upper' | 'lower';
    /** Whether to export comments in the output (default: false for compatibility) */
    exportComment?: boolean;
    /** Whether to use strict comment placement (only clause-level comments, default: false) */
    strictCommentPlacement?: boolean;
    /** Container types that should increase indentation level */
    indentIncrementContainerTypes?: SqlPrintTokenContainerType[];
    /** WITH clause formatting style (default: 'standard') */
    withClauseStyle?: WithClauseStyle;
}

/**
 * SqlPrinter formats a SqlPrintToken tree into a SQL string with flexible style options.
 * 
 * This class provides various formatting options including:
 * - Indentation control (character and size)
 * - Line break styles for commas and AND operators
 * - Keyword case transformation
 * - Comment handling
 * - WITH clause formatting styles
 * 
 * @example
 * const printer = new SqlPrinter({
 *   indentChar: '  ',
 *   indentSize: 1,
 *   keywordCase: 'upper',
 *   commaBreak: 'after',
 *   withClauseStyle: 'cte-oneline'
 * });
 * const formatted = printer.print(sqlToken);
 */
export class SqlPrinter {
    /** Indent character (e.g., ' ' or '\\t') */
    indentChar: IndentCharOption; // Changed type from string
    /** Indent size (number of indentChar repetitions per level) */
    indentSize: number;
    /** Newline character (e.g., '\\n' or '\\r\\n') */
    newline: NewlineOption; // Changed type from string
    /** Comma break style: 'none', 'before', or 'after' */
    commaBreak: CommaBreakStyle;
    /** AND break style: 'none', 'before', or 'after' */
    andBreak: AndBreakStyle;

    /** Keyword case style: 'none', 'upper' | 'lower' */
    keywordCase: 'none' | 'upper' | 'lower';

    /** Whether to export comments in the output (default: false for compatibility) */
    exportComment: boolean;

    /** Whether to use strict comment placement (only clause-level comments, default: false) */
    strictCommentPlacement: boolean;

    /** WITH clause formatting style (default: 'standard') */
    withClauseStyle: WithClauseStyle;

    private linePrinter: LinePrinter;
    private indentIncrementContainers: Set<SqlPrintTokenContainerType>;

    /**
     * @param options Optional style settings for pretty printing
     */
    constructor(options?: SqlPrinterOptions) {
        this.indentChar = options?.indentChar ?? '';
        this.indentSize = options?.indentSize ?? 0;

        // The default newline character is set to a blank space (' ') to enable one-liner formatting.
        // This is intentional and differs from the LinePrinter default of '\r\n'.
        this.newline = options?.newline ?? ' ';

        this.commaBreak = options?.commaBreak ?? 'none';
        this.andBreak = options?.andBreak ?? 'none';
        this.keywordCase = options?.keywordCase ?? 'none';
        this.exportComment = options?.exportComment ?? false;
        this.strictCommentPlacement = options?.strictCommentPlacement ?? false;
        this.withClauseStyle = options?.withClauseStyle ?? 'standard';
        this.linePrinter = new LinePrinter(this.indentChar, this.indentSize, this.newline);

        // Initialize
        this.indentIncrementContainers = new Set(
            options?.indentIncrementContainerTypes ?? [
                SqlPrintTokenContainerType.SelectClause,
                SqlPrintTokenContainerType.FromClause,
                SqlPrintTokenContainerType.WhereClause,
                SqlPrintTokenContainerType.GroupByClause,
                SqlPrintTokenContainerType.HavingClause,
                SqlPrintTokenContainerType.WindowFrameExpression,
                SqlPrintTokenContainerType.PartitionByClause,
                SqlPrintTokenContainerType.OrderByClause,
                SqlPrintTokenContainerType.WindowClause,
                SqlPrintTokenContainerType.LimitClause,
                SqlPrintTokenContainerType.OffsetClause,
                SqlPrintTokenContainerType.SubQuerySource,
                SqlPrintTokenContainerType.BinarySelectQueryOperator, SqlPrintTokenContainerType.Values,
                SqlPrintTokenContainerType.WithClause,
                SqlPrintTokenContainerType.SwitchCaseArgument,
                SqlPrintTokenContainerType.CaseKeyValuePair,
                SqlPrintTokenContainerType.CaseThenValue,
                SqlPrintTokenContainerType.ElseClause,
                SqlPrintTokenContainerType.CaseElseValue
                // CaseExpression, SwitchCaseArgument, CaseKeyValuePair, and ElseClause
                // are not included by default to maintain backward compatibility with tests
                //SqlPrintTokenContainerType.CommonTable
            ]
        );
    }

    /**
     * Converts a SqlPrintToken tree to a formatted SQL string.
     * @param token The root SqlPrintToken to format
     * @param level Initial indentation level (default: 0)
     * @returns Formatted SQL string
     * @example
     * const printer = new SqlPrinter({ indentChar: '  ', keywordCase: 'upper' });
     * const formatted = printer.print(sqlToken);
     */
    print(token: SqlPrintToken, level: number = 0): string {
        // initialize
        this.linePrinter = new LinePrinter(this.indentChar, this.indentSize, this.newline);
        if (this.linePrinter.lines.length > 0 && level !== this.linePrinter.lines[0].level) {
            this.linePrinter.lines[0].level = level;
        }

        this.appendToken(token, level);

        return this.linePrinter.print();
    }

    private appendToken(token: SqlPrintToken, level: number, parentContainerType?: SqlPrintTokenContainerType) {
        if (this.shouldSkipToken(token)) {
            return;
        }

        const current = this.linePrinter.getCurrentLine();

        // Handle different token types
        if (token.type === SqlPrintTokenType.keyword) {
            this.handleKeywordToken(token, level);
        } else if (token.type === SqlPrintTokenType.comma) {
            this.handleCommaToken(token, level, parentContainerType);
        } else if (token.type === SqlPrintTokenType.operator && token.text.toLowerCase() === 'and') {
            this.handleAndOperatorToken(token, level);
        } else if (token.containerType === "JoinClause") {
            this.handleJoinClauseToken(token, level);
        } else if (token.type === SqlPrintTokenType.comment) {
            this.handleCommentToken(token);
        } else if (token.containerType === SqlPrintTokenContainerType.CommonTable && this.withClauseStyle === 'cte-oneline') {
            this.handleCteOnelineToken(token, level);
            return; // Return early to avoid processing innerTokens
        } else if (token.containerType === SqlPrintTokenContainerType.WithClause && this.withClauseStyle === 'full-oneline') {
            this.handleWithClauseOnelineToken(token, level);
            return; // Return early to avoid processing innerTokens
        } else {
            this.linePrinter.appendText(token.text);
        }

        // append keyword tokens(not indented)
        if (token.keywordTokens && token.keywordTokens.length > 0) {
            for (let i = 0; i < token.keywordTokens.length; i++) {
                const keywordToken = token.keywordTokens[i];
                this.appendToken(keywordToken, level, token.containerType);
            }
        }

        let innerLevel = level;

        // indent level up
        if (this.newline !== ' ' && current.text !== '' && this.indentIncrementContainers.has(token.containerType)) { // Changed condition
            // Skip newline for WithClause when withClauseStyle is 'full-oneline'
            if (!(token.containerType === SqlPrintTokenContainerType.WithClause && this.withClauseStyle === 'full-oneline')) {
                innerLevel++;
                this.linePrinter.appendNewline(innerLevel);
            }
        }

        for (let i = 0; i < token.innerTokens.length; i++) {
            const child = token.innerTokens[i];
            this.appendToken(child, innerLevel, token.containerType);
        }

        // indent level down
        if (innerLevel !== level) {
            // Skip newline for WithClause when withClauseStyle is 'full-oneline'
            if (!(parentContainerType === SqlPrintTokenContainerType.WithClause && this.withClauseStyle === 'full-oneline')) {
                this.linePrinter.appendNewline(level);
            }
        }
    }

    private shouldSkipToken(token: SqlPrintToken): boolean {
        return (!token.innerTokens || token.innerTokens.length === 0) && token.text === '';
    }

    private applyKeywordCase(text: string): string {
        if (this.keywordCase === 'upper') {
            return text.toUpperCase();
        } else if (this.keywordCase === 'lower') {
            return text.toLowerCase();
        }
        return text;
    }

    private handleKeywordToken(token: SqlPrintToken, level: number): void {
        const text = this.applyKeywordCase(token.text);
        this.linePrinter.appendText(text);
    }

    private handleCommaToken(token: SqlPrintToken, level: number, parentContainerType?: SqlPrintTokenContainerType): void {
        const text = token.text;
        
        // Special handling for commas in WithClause when withClauseStyle is 'cte-oneline'
        if (this.withClauseStyle === 'cte-oneline' && parentContainerType === SqlPrintTokenContainerType.WithClause) {
            this.linePrinter.appendText(text);
            this.linePrinter.appendNewline(level);
        } else if (this.commaBreak === 'before') {
            this.linePrinter.appendNewline(level);
            this.linePrinter.appendText(text);
        } else if (this.commaBreak === 'after') {
            this.linePrinter.appendText(text);
            this.linePrinter.appendNewline(level);
        } else {
            this.linePrinter.appendText(text);
        }
    }

    private handleAndOperatorToken(token: SqlPrintToken, level: number): void {
        const text = this.applyKeywordCase(token.text);
        
        if (this.andBreak === 'before') {
            this.linePrinter.appendNewline(level);
            this.linePrinter.appendText(text);
        } else if (this.andBreak === 'after') {
            this.linePrinter.appendText(text);
            this.linePrinter.appendNewline(level);
        } else {
            this.linePrinter.appendText(text);
        }
    }

    private handleJoinClauseToken(token: SqlPrintToken, level: number): void {
        const text = this.applyKeywordCase(token.text);
        // before join clause, add newline
        this.linePrinter.appendNewline(level);
        this.linePrinter.appendText(text);
    }

    private handleCommentToken(token: SqlPrintToken): void {
        // Handle comments - only output if exportComment is true
        if (this.exportComment) {
            this.linePrinter.appendText(token.text);
            // Always add a space after comment to ensure SQL structure safety
            this.linePrinter.appendText(' ');
        }
    }

    private handleCteOnelineToken(token: SqlPrintToken, level: number): void {
        // Handle CTE with one-liner formatting when withClauseStyle is 'cte-oneline'
        const onelinePrinter = new SqlPrinter({
            indentChar: '',
            indentSize: 0,
            newline: ' ',
            commaBreak: this.commaBreak,
            andBreak: this.andBreak,
            keywordCase: this.keywordCase,
            exportComment: this.exportComment,
            strictCommentPlacement: this.strictCommentPlacement,
            withClauseStyle: 'standard', // Prevent recursive processing
        });
        
        const onelineResult = onelinePrinter.print(token, level);
        this.linePrinter.appendText(onelineResult);
    }

    private handleWithClauseOnelineToken(token: SqlPrintToken, level: number): void {
        // Handle entire WITH clause as one-liner when withClauseStyle is 'full-oneline'
        
        // Create a completely oneline printer for the entire WITH clause
        const onelinePrinter = new SqlPrinter({
            indentChar: '',
            indentSize: 0,
            newline: ' ',
            commaBreak: 'none',
            andBreak: this.andBreak,
            keywordCase: this.keywordCase,
            exportComment: this.exportComment,
            strictCommentPlacement: this.strictCommentPlacement,
            withClauseStyle: 'standard', // Prevent recursive processing
            indentIncrementContainerTypes: [], // Disable all indentation
        });
        
        // Print the entire WITH clause as one line
        const onelineResult = onelinePrinter.print(token, 0);
        this.linePrinter.appendText(onelineResult);
        
        // Add newline after WITH clause  
        this.linePrinter.appendNewline(level);
    }
}