import { SqlPrintToken, SqlPrintTokenType, SqlPrintTokenContainerType } from "../models/SqlPrintToken";
import { IndentCharOption, LinePrinter, NewlineOption } from "./LinePrinter";
import { resolveIndentCharOption, resolveNewlineOption } from "./FormatOptionResolver";
import { BaseFormattingOptions, WithClauseStyle, CommentStyle } from "./SqlFormatter";

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
export interface SqlPrinterOptions extends BaseFormattingOptions {
    /** Container types that should increase indentation level */
    indentIncrementContainerTypes?: SqlPrintTokenContainerType[];
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
    /** WITH clause comma break style (defaults to commaBreak) */
    cteCommaBreak: CommaBreakStyle;
    /** VALUES clause comma break style (defaults to commaBreak) */
    valuesCommaBreak: CommaBreakStyle;
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

    /** Comment formatting style (default: 'block') */
    commentStyle: CommentStyle;

    private linePrinter: LinePrinter;
    private indentIncrementContainers: Set<SqlPrintTokenContainerType>;
    
    /** Track whether we are currently inside a WITH clause for full-oneline formatting */
    private insideWithClause: boolean = false;
    /** Whether to keep parentheses content on one line */
    private parenthesesOneLine: boolean;
    /** Whether to keep BETWEEN expressions on one line */
    private betweenOneLine: boolean;
    /** Whether to keep VALUES clause on one line */
    private valuesOneLine: boolean;
    /** Whether to keep JOIN conditions on one line */
    private joinOneLine: boolean;
    /** Whether to keep CASE expressions on one line */
    private caseOneLine: boolean;
    /** Whether to keep subqueries on one line */
    private subqueryOneLine: boolean;

    /**
     * @param options Optional style settings for pretty printing
     */
    constructor(options?: SqlPrinterOptions) {
        // Resolve logical options to their control character representations before applying defaults.
        const resolvedIndentChar = resolveIndentCharOption(options?.indentChar);
        const resolvedNewline = resolveNewlineOption(options?.newline);

        this.indentChar = resolvedIndentChar ?? '';
        this.indentSize = options?.indentSize ?? 0;

        // The default newline character is set to a blank space (' ') to enable one-liner formatting.
        // This is intentional and differs from the LinePrinter default of '\r\n'.
        this.newline = resolvedNewline ?? ' ';

        this.commaBreak = options?.commaBreak ?? 'none';
        this.cteCommaBreak = options?.cteCommaBreak ?? this.commaBreak;
        this.valuesCommaBreak = options?.valuesCommaBreak ?? this.commaBreak;
        this.andBreak = options?.andBreak ?? 'none';
        this.keywordCase = options?.keywordCase ?? 'none';
        this.exportComment = options?.exportComment ?? false;
        this.strictCommentPlacement = options?.strictCommentPlacement ?? false;
        this.withClauseStyle = options?.withClauseStyle ?? 'standard';
        this.commentStyle = options?.commentStyle ?? 'block';
        this.parenthesesOneLine = options?.parenthesesOneLine ?? false;
        this.betweenOneLine = options?.betweenOneLine ?? false;
        this.valuesOneLine = options?.valuesOneLine ?? false;
        this.joinOneLine = options?.joinOneLine ?? false;
        this.caseOneLine = options?.caseOneLine ?? false;
        this.subqueryOneLine = options?.subqueryOneLine ?? false;
        this.linePrinter = new LinePrinter(this.indentChar, this.indentSize, this.newline, this.commaBreak);

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
        this.linePrinter = new LinePrinter(this.indentChar, this.indentSize, this.newline, this.commaBreak);
        this.insideWithClause = false; // Reset WITH clause context
        if (this.linePrinter.lines.length > 0 && level !== this.linePrinter.lines[0].level) {
            this.linePrinter.lines[0].level = level;
        }

        this.appendToken(token, level, undefined, 0);

        return this.linePrinter.print();
    }

    private appendToken(token: SqlPrintToken, level: number, parentContainerType?: SqlPrintTokenContainerType, caseContextDepth: number = 0): void {
        // Track WITH clause context for full-oneline formatting
        const wasInsideWithClause = this.insideWithClause;
        if (token.containerType === SqlPrintTokenContainerType.WithClause && this.withClauseStyle === 'full-oneline') {
            this.insideWithClause = true;
        }
        
        if (this.shouldSkipToken(token)) {
            return;
        }

        const current = this.linePrinter.getCurrentLine();
        const isCaseContext = this.isCaseContext(token.containerType);
        const nextCaseContextDepth = isCaseContext ? caseContextDepth + 1 : caseContextDepth;

        // Handle different token types
        if (token.type === SqlPrintTokenType.keyword) {
            this.handleKeywordToken(token, level, parentContainerType, caseContextDepth);
        } else if (token.type === SqlPrintTokenType.comma) {
            this.handleCommaToken(token, level, parentContainerType);
        } else if (token.type === SqlPrintTokenType.operator && token.text.toLowerCase() === 'and') {
            this.handleAndOperatorToken(token, level, parentContainerType, caseContextDepth);
        } else if (token.containerType === "JoinClause") {
            this.handleJoinClauseToken(token, level);
        } else if (token.type === SqlPrintTokenType.comment) {
            // Handle comments as regular tokens - let the standard processing handle everything
            if (this.exportComment) {
                // Note: Smart comment processing is handled at SqlPrintTokenParser level
                // via positioned comments system, so we don't need additional processing here
                this.linePrinter.appendText(token.text);
            }
        } else if (token.type === SqlPrintTokenType.space) {
            this.handleSpaceToken(token, parentContainerType);
        } else if (token.type === SqlPrintTokenType.commentNewline) {
            this.handleCommentNewlineToken(token, level);
        } else if (token.containerType === SqlPrintTokenContainerType.CommonTable && this.withClauseStyle === 'cte-oneline') {
            this.handleCteOnelineToken(token, level);
            return; // Return early to avoid processing innerTokens
        } else if ((token.containerType === SqlPrintTokenContainerType.ParenExpression && this.parenthesesOneLine) ||
                   (token.containerType === SqlPrintTokenContainerType.BetweenExpression && this.betweenOneLine) ||
                   (token.containerType === SqlPrintTokenContainerType.Values && this.valuesOneLine) ||
                   (token.containerType === SqlPrintTokenContainerType.JoinOnClause && this.joinOneLine) ||
                   (token.containerType === SqlPrintTokenContainerType.CaseExpression && this.caseOneLine) ||
                   (token.containerType === SqlPrintTokenContainerType.InlineQuery && this.subqueryOneLine)) {
            this.handleOnelineToken(token, level);
            return; // Return early to avoid processing innerTokens
        } else {
            this.linePrinter.appendText(token.text);
        }

        // append keyword tokens(not indented)
        if (token.keywordTokens && token.keywordTokens.length > 0) {
            for (let i = 0; i < token.keywordTokens.length; i++) {
                const keywordToken = token.keywordTokens[i];
                this.appendToken(keywordToken, level, token.containerType, nextCaseContextDepth);
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
            this.appendToken(child, innerLevel, token.containerType, nextCaseContextDepth);
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

    private isCaseContext(containerType?: SqlPrintTokenContainerType): boolean {
        switch (containerType) {
            case SqlPrintTokenContainerType.CaseExpression:
            case SqlPrintTokenContainerType.CaseKeyValuePair:
            case SqlPrintTokenContainerType.CaseThenValue:
            case SqlPrintTokenContainerType.CaseElseValue:
            case SqlPrintTokenContainerType.SwitchCaseArgument:
                return true;
            default:
                return false;
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

    private handleKeywordToken(token: SqlPrintToken, level: number, parentContainerType?: SqlPrintTokenContainerType, caseContextDepth: number = 0): void {
        const lower = token.text.toLowerCase();
        if (lower === 'and' && this.andBreak !== 'none') {
            this.handleAndOperatorToken(token, level, parentContainerType, caseContextDepth);
            return;
        }

        const text = this.applyKeywordCase(token.text);

        if (caseContextDepth > 0) {
            this.linePrinter.appendText(text);
            return;
        }
        this.linePrinter.appendText(text);
    }

    private handleCommaToken(token: SqlPrintToken, level: number, parentContainerType?: SqlPrintTokenContainerType): void {
        const text = token.text;
        const isWithinWithClause = parentContainerType === SqlPrintTokenContainerType.WithClause;
        const isWithinValuesClause = parentContainerType === SqlPrintTokenContainerType.Values;

        let effectiveCommaBreak: CommaBreakStyle = this.commaBreak;
        if (isWithinWithClause) {
            effectiveCommaBreak = this.cteCommaBreak;
        } else if (isWithinValuesClause) {
            effectiveCommaBreak = this.valuesCommaBreak;
        }

        // Skip comma newlines when inside WITH clause with full-oneline style
        if (this.insideWithClause && this.withClauseStyle === 'full-oneline') {
            this.linePrinter.appendText(text);
        }
        // Special handling for commas in WithClause when withClauseStyle is 'cte-oneline'
        else if (this.withClauseStyle === 'cte-oneline' && isWithinWithClause) {
            this.linePrinter.appendText(text);
            this.linePrinter.appendNewline(level);
        } else if (effectiveCommaBreak === 'before') {
            const previousCommaBreak = this.linePrinter.commaBreak;
            if (previousCommaBreak !== 'before') {
                this.linePrinter.commaBreak = 'before';
            }
            if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                this.linePrinter.appendNewline(level);
            }
            this.linePrinter.appendText(text);
            if (previousCommaBreak !== 'before') {
                this.linePrinter.commaBreak = previousCommaBreak;
            }
        } else if (effectiveCommaBreak === 'after') {
            const previousCommaBreak = this.linePrinter.commaBreak;
            if (previousCommaBreak !== 'after') {
                this.linePrinter.commaBreak = 'after';
            }
            this.linePrinter.appendText(text);
            if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                this.linePrinter.appendNewline(level);
            }
            if (previousCommaBreak !== 'after') {
                this.linePrinter.commaBreak = previousCommaBreak;
            }
        } else if (effectiveCommaBreak === 'none') {
            const previousCommaBreak = this.linePrinter.commaBreak;
            if (previousCommaBreak !== 'none') {
                this.linePrinter.commaBreak = 'none';
            }
            this.linePrinter.appendText(text);
            if (previousCommaBreak !== 'none') {
                this.linePrinter.commaBreak = previousCommaBreak;
            }
        } else {
            this.linePrinter.appendText(text);
        }
    }

    private handleAndOperatorToken(token: SqlPrintToken, level: number, parentContainerType?: SqlPrintTokenContainerType, caseContextDepth: number = 0): void {
        const text = this.applyKeywordCase(token.text);

        if (caseContextDepth > 0) {
            this.linePrinter.appendText(text);
            return;
        }

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
     * Handles space tokens with context-aware filtering.
     * Skips spaces in CommentBlocks when in specific CTE modes to prevent duplication.
     */
    private handleSpaceToken(token: SqlPrintToken, parentContainerType?: SqlPrintTokenContainerType): void {
        if (this.shouldSkipCommentBlockSpace(parentContainerType)) {
            const currentLine = this.linePrinter.getCurrentLine();
            if (currentLine.text !== '' && !currentLine.text.endsWith(' ')) {
                this.linePrinter.appendText(' ');
            }
            return;
        }
        this.linePrinter.appendText(token.text);
    }

    /**
     * Determines whether to skip space tokens in CommentBlocks.
     * Prevents duplicate spacing in CTE full-oneline mode only.
     */
    private shouldSkipCommentBlockSpace(parentContainerType?: SqlPrintTokenContainerType): boolean {
        return parentContainerType === SqlPrintTokenContainerType.CommentBlock && 
               this.insideWithClause && 
               this.withClauseStyle === 'full-oneline';
    }

    /**
     * Handles commentNewline tokens with conditional newline behavior.
     * In multiline mode (newline !== ' '), adds a newline after comments.
     * In oneliner mode (newline === ' '), does nothing to keep comments on same line.
     * Skips newlines in CTE modes (full-oneline, cte-oneline) to maintain one-line format.
     */
    private handleCommentNewlineToken(token: SqlPrintToken, level: number): void {
        if (this.shouldSkipCommentNewline()) {
            return;
        }
        
        if (!this.isOnelineMode()) {
            this.linePrinter.appendNewline(level);
        }
    }

    /**
     * Determines whether to skip commentNewline tokens.
     * Skips in CTE modes to maintain one-line formatting.
     */
    private shouldSkipCommentNewline(): boolean {
        return (this.insideWithClause && this.withClauseStyle === 'full-oneline') ||
               this.withClauseStyle === 'cte-oneline';
    }

    /**
     * Determines if the printer is in oneliner mode.
     * Oneliner mode uses single spaces instead of actual newlines.
     */
    private isOnelineMode(): boolean {
        return this.newline === ' ';
    }



    /**
     * Handles CTE tokens with one-liner formatting.
     * Creates a nested SqlPrinter instance for proper CTE oneline formatting.
     */
    private handleCteOnelineToken(token: SqlPrintToken, level: number): void {
        const onelinePrinter = this.createCteOnelinePrinter();
        const onelineResult = onelinePrinter.print(token, level);
        let cleanedResult = this.cleanDuplicateSpaces(onelineResult);
        cleanedResult = cleanedResult.replace(/\(\s+/g, '(').replace(/\s+\)/g, ' )');
        this.linePrinter.appendText(cleanedResult.trim());
    }

    /**
     * Creates a SqlPrinter instance configured for CTE oneline formatting.
     */
    private createCteOnelinePrinter(): SqlPrinter {
        return new SqlPrinter({
            indentChar: '',
            indentSize: 0,
            newline: ' ',
            commaBreak: this.commaBreak,
            cteCommaBreak: this.cteCommaBreak,
            valuesCommaBreak: this.valuesCommaBreak,
            andBreak: this.andBreak,
            keywordCase: this.keywordCase,
            exportComment: false,
            strictCommentPlacement: this.strictCommentPlacement,
            withClauseStyle: 'standard', // Prevent recursive processing
        });
    }

    /**
     * Handles tokens with oneline formatting (parentheses, BETWEEN, VALUES, JOIN, CASE, subqueries).
     * Creates a unified oneline printer that formats everything as one line regardless of content type.
     */
    private handleOnelineToken(token: SqlPrintToken, level: number): void {
        const onelinePrinter = this.createOnelinePrinter();
        const onelineResult = onelinePrinter.print(token, level);
        const cleanedResult = this.cleanDuplicateSpaces(onelineResult);
        this.linePrinter.appendText(cleanedResult);
    }

    /**
     * Creates a unified SqlPrinter instance configured for oneline formatting.
     * Works for all oneline options: parentheses, BETWEEN, VALUES, JOIN, CASE, subqueries.
     * Sets all oneline options to false to prevent recursion and uses newline=' ' for actual oneline effect.
     */
    private createOnelinePrinter(): SqlPrinter {
        return new SqlPrinter({
            indentChar: '',
            indentSize: 0,
            newline: ' ',              // KEY: Replace all newlines with spaces - this makes everything oneline!
            commaBreak: 'none',        // Disable comma-based line breaks
            cteCommaBreak: this.cteCommaBreak,
            valuesCommaBreak: 'none',
            andBreak: 'none',          // Disable AND/OR-based line breaks
            keywordCase: this.keywordCase,
            exportComment: this.exportComment,
            strictCommentPlacement: this.strictCommentPlacement,
            withClauseStyle: 'standard',
            parenthesesOneLine: false, // Prevent recursive processing (avoid infinite loops)
            betweenOneLine: false,     // Prevent recursive processing (avoid infinite loops)
            valuesOneLine: false,      // Prevent recursive processing (avoid infinite loops)
            joinOneLine: false,        // Prevent recursive processing (avoid infinite loops)
            caseOneLine: false,        // Prevent recursive processing (avoid infinite loops)
            subqueryOneLine: false,    // Prevent recursive processing (avoid infinite loops)
        });
    }


    /**
     * Removes duplicate consecutive spaces while preserving single spaces.
     * Simple and safe space normalization for CTE oneline mode.
     */
    private cleanDuplicateSpaces(text: string): string {
        return text.replace(/\s{2,}/g, ' ');
    }


}
