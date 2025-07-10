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
    
    /** Track whether we are currently inside a WITH clause for full-oneline formatting */
    private insideWithClause: boolean = false;

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
                SqlPrintTokenContainerType.CaseElseValue,
                SqlPrintTokenContainerType.SimpleSelectQuery
                // Note: CommentBlock is intentionally excluded from indentIncrementContainers
                // because it serves as a grouping mechanism without affecting indentation.
                // CaseExpression, SwitchCaseArgument, CaseKeyValuePair, and ElseClause
                // are not included by default to maintain backward compatibility with tests.
                // SqlPrintTokenContainerType.CommonTable is also excluded by default.
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
        this.insideWithClause = false; // Reset WITH clause context
        if (this.linePrinter.lines.length > 0 && level !== this.linePrinter.lines[0].level) {
            this.linePrinter.lines[0].level = level;
        }

        this.appendToken(token, level, undefined);

        return this.linePrinter.print();
    }

    private appendToken(token: SqlPrintToken, level: number, parentContainerType?: SqlPrintTokenContainerType) {
        // Track WITH clause context for full-oneline formatting
        const wasInsideWithClause = this.insideWithClause;
        if (token.containerType === SqlPrintTokenContainerType.WithClause && this.withClauseStyle === 'full-oneline') {
            this.insideWithClause = true;
        }
        
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
            // Handle comments as regular tokens - let the standard processing handle everything
            if (this.exportComment) {
                this.linePrinter.appendText(token.text);
            }
        } else if (token.type === SqlPrintTokenType.space) {
            // Skip spaces in CommentBlocks when in CTE oneliner modes to avoid duplication
            if (parentContainerType === SqlPrintTokenContainerType.CommentBlock) {
                if (this.isOnelineMode() || 
                    (this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                    return; // Skip space to avoid duplication with CTE's natural spacing
                }
            }
            // Use standard LinePrinter.appendText to handle leading space filtering
            this.linePrinter.appendText(token.text);
        } else if (token.type === SqlPrintTokenType.commentNewline) {
            this.handleCommentNewlineToken(token, level);
        } else if (token.containerType === SqlPrintTokenContainerType.CommonTable && this.withClauseStyle === 'cte-oneline') {
            this.handleCteOnelineToken(token, level);
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
        if (!this.isOnelineMode() && current.text !== '' && this.indentIncrementContainers.has(token.containerType)) {
            // Skip newline for any container when inside WITH clause with full-oneline style
            if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                innerLevel++;
                this.linePrinter.appendNewline(innerLevel);
            }
        }

        for (let i = 0; i < token.innerTokens.length; i++) {
            const child = token.innerTokens[i];
            this.appendToken(child, innerLevel, token.containerType);
        }
        
        // Exit WITH clause context when we finish processing WithClause container
        if (token.containerType === SqlPrintTokenContainerType.WithClause && this.withClauseStyle === 'full-oneline') {
            this.insideWithClause = false;
            // Add newline after WITH clause to separate it from main SELECT
            this.linePrinter.appendNewline(level);
            return; // Return early to avoid additional newline below
        }

        // indent level down
        if (innerLevel !== level) {
            // Skip newline for any container when inside WITH clause with full-oneline style
            if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                this.linePrinter.appendNewline(level);
            }
        }
    }

    /**
     * Determines if a token should be skipped during printing.
     * Tokens are skipped if they have no content and no inner tokens,
     * except for special token types that have semantic meaning despite empty text.
     */
    private shouldSkipToken(token: SqlPrintToken): boolean {
        // Special tokens with semantic meaning should never be skipped
        if (token.type === SqlPrintTokenType.commentNewline) {
            return false;
        }
        
        // Skip tokens that have no content and no children
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
        
        // Skip comma newlines when inside WITH clause with full-oneline style
        if (this.insideWithClause && this.withClauseStyle === 'full-oneline') {
            this.linePrinter.appendText(text);
        }
        // Special handling for commas in WithClause when withClauseStyle is 'cte-oneline'
        else if (this.withClauseStyle === 'cte-oneline' && parentContainerType === SqlPrintTokenContainerType.WithClause) {
            this.linePrinter.appendText(text);
            this.linePrinter.appendNewline(level);
        } else if (this.commaBreak === 'before') {
            // Skip newline when inside WITH clause with full-oneline style
            if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                this.linePrinter.appendNewline(level);
            }
            this.linePrinter.appendText(text);
        } else if (this.commaBreak === 'after') {
            this.linePrinter.appendText(text);
            // Skip newline when inside WITH clause with full-oneline style
            if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                this.linePrinter.appendNewline(level);
            }
        } else {
            this.linePrinter.appendText(text);
        }
    }

    private handleAndOperatorToken(token: SqlPrintToken, level: number): void {
        const text = this.applyKeywordCase(token.text);
        
        if (this.andBreak === 'before') {
            // Skip newline when inside WITH clause with full-oneline style
            if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                this.linePrinter.appendNewline(level);
            }
            this.linePrinter.appendText(text);
        } else if (this.andBreak === 'after') {
            this.linePrinter.appendText(text);
            // Skip newline when inside WITH clause with full-oneline style
            if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                this.linePrinter.appendNewline(level);
            }
        } else {
            this.linePrinter.appendText(text);
        }
    }

    private handleJoinClauseToken(token: SqlPrintToken, level: number): void {
        const text = this.applyKeywordCase(token.text);
        // before join clause, add newline (skip when inside WITH clause with full-oneline style)
        if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
            this.linePrinter.appendNewline(level);
        }
        this.linePrinter.appendText(text);
    }

    /**
     * Handles commentNewline tokens with conditional newline behavior.
     * In multiline mode (newline !== ' '), adds a newline after comments.
     * In oneliner mode (newline === ' '), does nothing to keep comments on same line.
     * Skips newlines in CTE modes (full-oneline, cte-oneline) to maintain one-line format.
     */
    private handleCommentNewlineToken(token: SqlPrintToken, level: number): void {
        // Skip newlines when inside WITH clause with full-oneline style
        if (this.insideWithClause && this.withClauseStyle === 'full-oneline') {
            return;
        }
        
        // Skip newlines for cte-oneline style (handled by handleCteOnelineToken)
        if (this.withClauseStyle === 'cte-oneline') {
            return;
        }
        
        if (!this.isOnelineMode()) {
            this.linePrinter.appendNewline(level);
        }
    }

    /**
     * Determines if the printer is in oneliner mode.
     * Oneliner mode uses single spaces instead of actual newlines.
     */
    private isOnelineMode(): boolean {
        return this.newline === ' ';
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

}