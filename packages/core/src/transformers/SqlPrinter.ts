import { SqlPrintToken, SqlPrintTokenType, SqlPrintTokenContainerType } from "../models/SqlPrintToken";
import { IndentCharOption, LinePrinter, NewlineOption } from "./LinePrinter";
import { resolveIndentCharOption, resolveNewlineOption } from "./FormatOptionResolver";
import { BaseFormattingOptions, WithClauseStyle, CommentStyle } from "./SqlFormatter";
import {
    OnelineFormattingHelper,
    OnelineFormattingOptions,
    CommaBreakStyle as HelperCommaBreakStyle,
} from "./OnelineFormattingHelper";
import { CommentExportMode } from "../types/Formatting";

const CREATE_TABLE_SINGLE_PAREN_KEYWORDS = new Set(['unique', 'check', 'key', 'index']);
const CREATE_TABLE_MULTI_PAREN_KEYWORDS = new Set(['primary key', 'foreign key', 'unique key']);
const CREATE_TABLE_PAREN_KEYWORDS_WITH_IDENTIFIER = new Set(['references']);

/**
 * CommaBreakStyle determines how commas are placed in formatted SQL output.
 * - 'none': No line break for commas
 * - 'before': Line break before comma
 * - 'after': Line break after comma
 */
export type CommaBreakStyle = HelperCommaBreakStyle;

/**
 * AndBreakStyle determines how AND operators are placed in formatted SQL output.
 * - 'none': No line break for AND
 * - 'before': Line break before AND
 * - 'after': Line break after AND
 */
export type AndBreakStyle = 'none' | 'before' | 'after';

/**
 * OrBreakStyle determines how OR operators are placed in formatted SQL output.
 * - 'none': No line break for OR
 * - 'before': Line break before OR
 * - 'after': Line break after OR
 */
export type OrBreakStyle = 'none' | 'before' | 'after';

interface CommentRenderContext {
    position: 'leading' | 'inline';
    isTopLevelContainer: boolean;
    forceRender?: boolean;
}

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
    /** OR break style: 'none', 'before', or 'after' */
    orBreak: OrBreakStyle;

    /** Keyword case style: 'none', 'upper' | 'lower' */
    keywordCase: 'none' | 'upper' | 'lower';

    /** Comment export mode controlling how comments are emitted */
    commentExportMode: CommentExportMode;


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
    /** Whether to indent nested parentheses when boolean groups get expanded */
    private indentNestedParentheses: boolean;
    /** Whether to keep INSERT column lists on one line */
    private insertColumnsOneLine: boolean;
    /** Whether to keep MERGE WHEN predicates on a single line */
    private whenOneLine: boolean;
    /** Tracks nesting depth while formatting MERGE WHEN predicate segments */
    private mergeWhenPredicateDepth = 0;
    /** Shared helper for oneline-specific formatting decisions */
    private onelineHelper: OnelineFormattingHelper;
    /** Pending line comment that needs a forced newline before next token */
    private pendingLineCommentBreak: number | null = null;
    /** Accumulates lines when reconstructing multi-line block comments inside CommentBlocks */
    private smartCommentBlockBuilder: { lines: string[]; level: number; mode: 'block' | 'line' } | null = null;

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
        this.orBreak = options?.orBreak ?? 'none';
        this.keywordCase = options?.keywordCase ?? 'none';
        this.commentExportMode = this.resolveCommentExportMode(options?.exportComment);
        this.withClauseStyle = options?.withClauseStyle ?? 'standard';
        this.commentStyle = options?.commentStyle ?? 'block';
        this.parenthesesOneLine = options?.parenthesesOneLine ?? false;
        this.betweenOneLine = options?.betweenOneLine ?? false;
        this.valuesOneLine = options?.valuesOneLine ?? false;
        this.joinOneLine = options?.joinOneLine ?? false;
        this.caseOneLine = options?.caseOneLine ?? false;
        this.subqueryOneLine = options?.subqueryOneLine ?? false;
        this.indentNestedParentheses = options?.indentNestedParentheses ?? false;
        this.insertColumnsOneLine = options?.insertColumnsOneLine ?? false;
        this.whenOneLine = options?.whenOneLine ?? false;
        const onelineOptions: OnelineFormattingOptions = {
            parenthesesOneLine: this.parenthesesOneLine,
            betweenOneLine: this.betweenOneLine,
            valuesOneLine: this.valuesOneLine,
            joinOneLine: this.joinOneLine,
            caseOneLine: this.caseOneLine,
            subqueryOneLine: this.subqueryOneLine,
            insertColumnsOneLine: this.insertColumnsOneLine,
            withClauseStyle: this.withClauseStyle,
        };
        this.onelineHelper = new OnelineFormattingHelper(onelineOptions);
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
                SqlPrintTokenContainerType.SimpleSelectQuery,
                SqlPrintTokenContainerType.CreateTableDefinition,
                SqlPrintTokenContainerType.AlterTableStatement,
                SqlPrintTokenContainerType.IndexColumnList,
                SqlPrintTokenContainerType.SetClause
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
        this.pendingLineCommentBreak = null;
        this.smartCommentBlockBuilder = null;
        if (this.linePrinter.lines.length > 0 && level !== this.linePrinter.lines[0].level) {
            this.linePrinter.lines[0].level = level;
        }

        this.appendToken(token, level, undefined, 0, false, undefined, false);

        return this.linePrinter.print();
    }

    // Resolve legacy boolean values into explicit comment export modes.
    private resolveCommentExportMode(option?: boolean | CommentExportMode): CommentExportMode {
        if (option === undefined) {
            return 'none';
        }
        if (option === true) {
            return 'full';
        }
        if (option === false) {
            return 'none';
        }
        return option;
    }

    // Determine whether the current mode allows emitting inline comments.
    private rendersInlineComments(): boolean {
        return this.commentExportMode === 'full';
    }

    // Decide if a comment block or token should be rendered given its context.
    private shouldRenderComment(token: SqlPrintToken, context?: CommentRenderContext): boolean {
        if (context?.forceRender) {
            return this.commentExportMode !== 'none';
        }

        switch (this.commentExportMode) {
            case 'full':
                return true;
            case 'none':
                return false;
            case 'header-only':
                return token.isHeaderComment === true;
            case 'top-header-only':
                return token.isHeaderComment === true && Boolean(context?.isTopLevelContainer);
            default:
                return false;
        }
    }

    private appendToken(
        token: SqlPrintToken,
        level: number,
        parentContainerType?: SqlPrintTokenContainerType,
        caseContextDepth: number = 0,
        indentParentActive: boolean = false,
        commentContext?: CommentRenderContext,
        previousSiblingWasOpenParen: boolean = false
    ): void {
        // Track WITH clause context for full-oneline formatting
        const wasInsideWithClause = this.insideWithClause;
        if (token.containerType === SqlPrintTokenContainerType.WithClause && this.withClauseStyle === 'full-oneline') {
            this.insideWithClause = true;
        }

        if (this.shouldSkipToken(token)) {
            return;
        }

        const containerIsTopLevel = parentContainerType === undefined;

        let leadingCommentCount = 0;
        // Collect leading comment blocks with context so we can respect the export mode.
        const leadingCommentContexts: Array<{ token: SqlPrintToken; context: CommentRenderContext; shouldRender: boolean }> = [];
        if (token.innerTokens && token.innerTokens.length > 0) {
            while (leadingCommentCount < token.innerTokens.length) {
                const leadingCandidate = token.innerTokens[leadingCommentCount];
                if (leadingCandidate.containerType !== SqlPrintTokenContainerType.CommentBlock) {
                    break;
                }
                const context: CommentRenderContext = {
                    position: 'leading',
                    isTopLevelContainer: containerIsTopLevel,
                };
                const shouldRender = this.shouldRenderComment(leadingCandidate, context);
                leadingCommentContexts.push({ token: leadingCandidate, context, shouldRender });
                leadingCommentCount++;
            }
        }

        const hasRenderableLeadingComment = leadingCommentContexts.some(item => item.shouldRender);
        const leadingCommentIndentLevel = hasRenderableLeadingComment
            ? this.getLeadingCommentIndentLevel(parentContainerType, level)
            : null;

        if (
            hasRenderableLeadingComment
            && !this.isOnelineMode()
            && this.shouldAddNewlineBeforeLeadingComments(parentContainerType)
        ) {
            const currentLine = this.linePrinter.getCurrentLine();
            if (currentLine.text.trim().length > 0) {
                // Align the newline before leading comments with the intended comment indentation.
                this.linePrinter.appendNewline(leadingCommentIndentLevel ?? level);
            }
        }

        for (const leading of leadingCommentContexts) {
            if (!leading.shouldRender) {
                continue;
            }
            // Keep leading comment processing aligned with its computed indentation level.
            this.appendToken(
                leading.token,
                leadingCommentIndentLevel ?? level,
                token.containerType,
                caseContextDepth,
                indentParentActive,
                leading.context,
                false
            );
        }

        if (this.smartCommentBlockBuilder && token.containerType !== SqlPrintTokenContainerType.CommentBlock && token.type !== SqlPrintTokenType.commentNewline) {
            this.flushSmartCommentBlockBuilder();
        }

        if (this.pendingLineCommentBreak !== null) {
            if (!this.isOnelineMode()) {
                this.linePrinter.appendNewline(this.pendingLineCommentBreak);
            }
            const shouldSkipToken = token.type === SqlPrintTokenType.commentNewline;
            this.pendingLineCommentBreak = null;
            if (shouldSkipToken) {
                return;
            }
        }

        // Fallback context applies when the caller did not provide comment metadata.
        const effectiveCommentContext: CommentRenderContext = commentContext ?? {
            position: 'inline',
            isTopLevelContainer: containerIsTopLevel,
        };

        if (token.containerType === SqlPrintTokenContainerType.CommentBlock) {
            if (!this.shouldRenderComment(token, effectiveCommentContext)) {
                return;
            }
            const commentLevel = this.getCommentBaseIndentLevel(level, parentContainerType);
            this.handleCommentBlockContainer(token, commentLevel, effectiveCommentContext);
            return;
        }

        const current = this.linePrinter.getCurrentLine();
        const isCaseContext = this.isCaseContext(token.containerType);
        const nextCaseContextDepth = isCaseContext ? caseContextDepth + 1 : caseContextDepth;
        const shouldIndentNested = this.shouldIndentNestedParentheses(token, previousSiblingWasOpenParen);

        // Handle different token types
        if (token.type === SqlPrintTokenType.keyword) {
            this.handleKeywordToken(token, level, parentContainerType, caseContextDepth);
        } else if (token.type === SqlPrintTokenType.comma) {
            this.handleCommaToken(token, level, parentContainerType);
        } else if (token.type === SqlPrintTokenType.parenthesis) {
            this.handleParenthesisToken(token, level, indentParentActive, parentContainerType);
        } else if (token.type === SqlPrintTokenType.operator && token.text.toLowerCase() === 'and') {
            this.handleAndOperatorToken(token, level, parentContainerType, caseContextDepth);
        } else if (token.type === SqlPrintTokenType.operator && token.text.toLowerCase() === 'or') {
            this.handleOrOperatorToken(token, level, parentContainerType, caseContextDepth);
        } else if (token.containerType === SqlPrintTokenContainerType.JoinClause) {
            this.handleJoinClauseToken(token, level);
        } else if (token.type === SqlPrintTokenType.comment) {
            if (this.shouldRenderComment(token, effectiveCommentContext)) {
                const commentLevel = this.getCommentBaseIndentLevel(level, parentContainerType);
                this.printCommentToken(token.text, commentLevel, parentContainerType);
            }
        } else if (token.type === SqlPrintTokenType.space) {
            this.handleSpaceToken(token, parentContainerType);
        } else if (token.type === SqlPrintTokenType.commentNewline) {
            if (this.whenOneLine && parentContainerType === SqlPrintTokenContainerType.MergeWhenClause) {
                return;
            }
            const commentLevel = this.getCommentBaseIndentLevel(level, parentContainerType);
            this.handleCommentNewlineToken(token, commentLevel);
        } else if (token.containerType === SqlPrintTokenContainerType.CommonTable && this.withClauseStyle === 'cte-oneline') {
            this.handleCteOnelineToken(token, level);
            return; // Return early to avoid processing innerTokens
        } else if (this.shouldFormatContainerAsOneline(token, shouldIndentNested)) {
            this.handleOnelineToken(token, level);
            return; // Return early to avoid processing innerTokens
        } else if (!this.tryAppendInsertClauseTokenText(token.text, parentContainerType)) {
            this.linePrinter.appendText(token.text);
        }

        // append keyword tokens(not indented)
        if (token.keywordTokens && token.keywordTokens.length > 0) {
            for (let i = 0; i < token.keywordTokens.length; i++) {
                const keywordToken = token.keywordTokens[i];
                this.appendToken(
                    keywordToken,
                    level,
                    token.containerType,
                    nextCaseContextDepth,
                    indentParentActive,
                    undefined,
                    false
                );
            }
        }

        let innerLevel = level;
        let increasedIndent = false;
        const shouldIncreaseIndent = this.indentIncrementContainers.has(token.containerType) || shouldIndentNested;
        const delayIndentNewline = shouldIndentNested && token.containerType === SqlPrintTokenContainerType.ParenExpression;
        const isAlterTableStatement = token.containerType === SqlPrintTokenContainerType.AlterTableStatement;
        let deferAlterTableIndent = false;

        const alignExplainChild = this.shouldAlignExplainStatementChild(parentContainerType, token.containerType);

        if (alignExplainChild) {
            // Keep EXPLAIN target statements flush left so they render like standalone statements.
            if (!this.isOnelineMode() && current.text !== '') {
                this.linePrinter.appendNewline(level);
            }
            innerLevel = level;
            increasedIndent = false;
        } else if (!this.isOnelineMode() && shouldIncreaseIndent) {
            if (this.insideWithClause && this.withClauseStyle === 'full-oneline') {
                // Keep everything on one line for full-oneline WITH clauses.
            } else if (delayIndentNewline) {
                innerLevel = level + 1;
                increasedIndent = true;
            } else if (current.text !== '') {
                if (isAlterTableStatement) {
                    // Delay the first line break so ALTER TABLE keeps the table name on the opening line.
                    innerLevel = level + 1;
                    increasedIndent = true;
                    deferAlterTableIndent = true;
                } else {
                    let targetIndentLevel = level + 1;
                    if (
                        token.containerType === SqlPrintTokenContainerType.SetClause &&
                        parentContainerType === SqlPrintTokenContainerType.MergeUpdateAction
                    ) {
                        targetIndentLevel = level + 2;
                    }
                    if (this.shouldAlignCreateTableSelect(token.containerType, parentContainerType)) {
                        innerLevel = level;
                        increasedIndent = false;
                        this.linePrinter.appendNewline(level);
                    } else {
                        innerLevel = targetIndentLevel;
                        increasedIndent = true;
                        this.linePrinter.appendNewline(innerLevel);
                    }
                }
            } else if (token.containerType === SqlPrintTokenContainerType.SetClause) {
                innerLevel = parentContainerType === SqlPrintTokenContainerType.MergeUpdateAction ? level + 2 : level + 1;
                increasedIndent = true;
                current.level = innerLevel;
            }
        }

        const isMergeWhenClause = this.whenOneLine && token.containerType === SqlPrintTokenContainerType.MergeWhenClause;
        let mergePredicateActive = isMergeWhenClause;
        let alterTableTableRendered = false;
        let alterTableIndentInserted = false;

        for (let i = leadingCommentCount; i < token.innerTokens.length; i++) {
            const child = token.innerTokens[i];
            const nextChild = token.innerTokens[i + 1];
            const previousEntry = this.findPreviousSignificantToken(token.innerTokens, i);
            const previousChild = previousEntry?.token;
            const priorEntry = previousEntry ? this.findPreviousSignificantToken(token.innerTokens, previousEntry.index) : undefined;
            const priorChild = priorEntry?.token;
            const childIsAction = this.isMergeActionContainer(child);
            const nextIsAction = this.isMergeActionContainer(nextChild);
            const inMergePredicate = mergePredicateActive && !childIsAction;

            if (isAlterTableStatement) {
                if (child.containerType === SqlPrintTokenContainerType.QualifiedName) {
                    // Track when the table name has been printed so we can defer indentation until after it.
                    alterTableTableRendered = true;
                } else if (deferAlterTableIndent && alterTableTableRendered && !alterTableIndentInserted) {
                    if (!this.isOnelineMode()) {
                        this.linePrinter.appendNewline(innerLevel);
                    }
                    alterTableIndentInserted = true;
                    deferAlterTableIndent = false;
                    if (!this.isOnelineMode() && child.type === SqlPrintTokenType.space) {
                        // Drop the space token because we already emitted a newline.
                        continue;
                    }
                }
            }

            if (child.type === SqlPrintTokenType.space) {
                if (this.shouldConvertSpaceToClauseBreak(token.containerType, nextChild)) {
                    if (!this.isOnelineMode()) {
                        // Use a dedicated indent resolver so clause breaks can shift indentation for nested blocks.
                        const clauseBreakIndent = this.getClauseBreakIndentLevel(token.containerType, innerLevel);
                        this.linePrinter.appendNewline(clauseBreakIndent);
                    }
                    if (isMergeWhenClause && nextIsAction) {
                        mergePredicateActive = false;
                    }
                    continue;
                }
                this.handleSpaceToken(child, token.containerType, nextChild, previousChild, priorChild);
                continue;
            }

            const previousChildWasOpenParen =
                previousChild?.type === SqlPrintTokenType.parenthesis && previousChild.text.trim() === '(';
            const childIndentParentActive = token.containerType === SqlPrintTokenContainerType.ParenExpression ? shouldIndentNested : indentParentActive;
            if (inMergePredicate) {
                this.mergeWhenPredicateDepth++;
            }
            const childCommentContext: CommentRenderContext | undefined = child.containerType === SqlPrintTokenContainerType.CommentBlock
                ? { position: 'inline', isTopLevelContainer: containerIsTopLevel }
                : undefined;
            this.appendToken(
                child,
                innerLevel,
                token.containerType,
                nextCaseContextDepth,
                childIndentParentActive,
                childCommentContext,
                previousChildWasOpenParen
            );
            if (inMergePredicate) {
                this.mergeWhenPredicateDepth--;
            }
            if (childIsAction && isMergeWhenClause) {
                mergePredicateActive = false;
            }
        }

        if (this.smartCommentBlockBuilder && this.smartCommentBlockBuilder.mode === 'line') {
            this.flushSmartCommentBlockBuilder();
        }

        // Exit WITH clause context when we finish processing WithClause container
        if (token.containerType === SqlPrintTokenContainerType.WithClause && this.withClauseStyle === 'full-oneline') {
            this.insideWithClause = false;
            // Add newline after WITH clause to separate it from main SELECT
            this.linePrinter.appendNewline(level);
            return; // Return early to avoid additional newline below
        }

        // indent level down
        if (increasedIndent && shouldIncreaseIndent && !(this.insideWithClause && this.withClauseStyle === 'full-oneline') && !delayIndentNewline) {
            this.linePrinter.appendNewline(level);
        }
    }

    private shouldAlignExplainStatementChild(parentType: SqlPrintTokenContainerType | undefined, childType: SqlPrintTokenContainerType): boolean {
        if (parentType !== SqlPrintTokenContainerType.ExplainStatement) {
            return false;
        }
        switch (childType) {
            case SqlPrintTokenContainerType.SimpleSelectQuery:
            case SqlPrintTokenContainerType.InsertQuery:
            case SqlPrintTokenContainerType.UpdateQuery:
            case SqlPrintTokenContainerType.DeleteQuery:
            case SqlPrintTokenContainerType.MergeQuery:
                return true;
            default:
                return false;
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
        if (
            lower === 'and' &&
            (this.andBreak !== 'none' || (this.whenOneLine && parentContainerType === SqlPrintTokenContainerType.MergeWhenClause))
        ) {
            this.handleAndOperatorToken(token, level, parentContainerType, caseContextDepth);
            return;
        } else if (
            lower === 'or' &&
            (this.orBreak !== 'none' || (this.whenOneLine && parentContainerType === SqlPrintTokenContainerType.MergeWhenClause))
        ) {
            this.handleOrOperatorToken(token, level, parentContainerType, caseContextDepth);
            return;
        }

        const text = this.applyKeywordCase(token.text);

        if (caseContextDepth > 0) {
            this.linePrinter.appendText(text);
            return;
        }

        this.ensureSpaceBeforeKeyword();
        this.linePrinter.appendText(text);
    }

    private ensureSpaceBeforeKeyword(): void {
        const currentLine = this.linePrinter.getCurrentLine();
        if (currentLine.text === '') {
            return;
        }
        const lastChar = currentLine.text[currentLine.text.length - 1];
        if (lastChar === '(') {
            return;
        }
        this.ensureTrailingSpace();
    }

    private ensureTrailingSpace(): void {
        const currentLine = this.linePrinter.getCurrentLine();
        if (currentLine.text === '') {
            return;
        }
        if (!currentLine.text.endsWith(' ')) {
            currentLine.text += ' ';
        }
        currentLine.text = currentLine.text.replace(/\s+$/, ' ');
    }

    /**
     * Normalizes INSERT column list token text when one-line formatting is active.
     */
    private tryAppendInsertClauseTokenText(text: string, parentContainerType?: SqlPrintTokenContainerType): boolean {
        const currentLineText = this.linePrinter.getCurrentLine().text;
        const result = this.onelineHelper.formatInsertClauseToken(
            text,
            parentContainerType,
            currentLineText,
            () => this.ensureTrailingSpace(),
        );
        if (!result.handled) {
            return false;
        }
        if (result.text) {
            this.linePrinter.appendText(result.text);
        }
        return true;
    }

    private handleCommaToken(token: SqlPrintToken, level: number, parentContainerType?: SqlPrintTokenContainerType): void {
        const text = token.text;
        const isWithinWithClause = parentContainerType === SqlPrintTokenContainerType.WithClause;
        let effectiveCommaBreak = this.onelineHelper.resolveCommaBreak(
            parentContainerType,
            this.commaBreak,
            this.cteCommaBreak,
            this.valuesCommaBreak,
        );

        if (parentContainerType === SqlPrintTokenContainerType.SetClause) {
            effectiveCommaBreak = 'before';
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
                if (this.newline === ' ') {
                    // Remove the spacer introduced by space newlines so commas attach directly to the preceding token.
                    this.linePrinter.trimTrailingWhitespaceFromPreviousLine();
                }
                if (parentContainerType === SqlPrintTokenContainerType.InsertClause) {
                    // Align comma-prefixed column entries under the INSERT column indentation.
                    this.linePrinter.getCurrentLine().level = level + 1;
                }
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
            if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                this.linePrinter.appendNewline(level);
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
            if (this.onelineHelper.isInsertClauseOneline(parentContainerType)) {
                this.ensureTrailingSpace();
            }
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

        if (
            this.whenOneLine &&
            (parentContainerType === SqlPrintTokenContainerType.MergeWhenClause || this.mergeWhenPredicateDepth > 0)
        ) {
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

    private handleParenthesisToken(token: SqlPrintToken, level: number, indentParentActive: boolean, parentContainerType?: SqlPrintTokenContainerType): void {
        if (token.text === '(') {
            this.linePrinter.appendText(token.text);
            if (
                (parentContainerType === SqlPrintTokenContainerType.InsertClause ||
                    parentContainerType === SqlPrintTokenContainerType.MergeInsertAction) &&
                this.insertColumnsOneLine
            ) {
                return;
            }
            if (!this.isOnelineMode()) {
                if (this.shouldBreakAfterOpeningParen(parentContainerType)) {
                    this.linePrinter.appendNewline(level + 1);
                } else if (indentParentActive && !(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                    this.linePrinter.appendNewline(level);
                }
            }
            return;
        }

        if (token.text === ')' && !this.isOnelineMode()) {
            if (this.shouldBreakBeforeClosingParen(parentContainerType)) {
                this.linePrinter.appendNewline(Math.max(level, 0));
                this.linePrinter.appendText(token.text);
                return;
            }
            if (indentParentActive && !(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                const closingLevel = Math.max(level - 1, 0);
                this.linePrinter.appendNewline(closingLevel);
            }
        }
        this.linePrinter.appendText(token.text);
    }

    private handleOrOperatorToken(token: SqlPrintToken, level: number, parentContainerType?: SqlPrintTokenContainerType, caseContextDepth: number = 0): void {
        const text = this.applyKeywordCase(token.text);

        // Leave OR untouched inside CASE branches to preserve inline evaluation order.
        if (caseContextDepth > 0) {
            this.linePrinter.appendText(text);
            return;
        }

        if (
            this.whenOneLine &&
            (parentContainerType === SqlPrintTokenContainerType.MergeWhenClause || this.mergeWhenPredicateDepth > 0)
        ) {
            this.linePrinter.appendText(text);
            return;
        }

        if (this.orBreak === 'before') {
            // Insert a newline before OR unless WITH full-oneline mode suppresses breaks.
            if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                this.linePrinter.appendNewline(level);
            }
            this.linePrinter.appendText(text);
        } else if (this.orBreak === 'after') {
            this.linePrinter.appendText(text);
            // Break after OR when multi-line formatting is active.
            if (!(this.insideWithClause && this.withClauseStyle === 'full-oneline')) {
                this.linePrinter.appendNewline(level);
            }
        } else {
            this.linePrinter.appendText(text);
        }
    }

    /**
     * Decide whether a parentheses group should increase indentation when inside nested structures.
     * We only expand groups that contain further parentheses so simple comparisons stay compact.
     */
    private shouldIndentNestedParentheses(token: SqlPrintToken, previousSiblingWasOpenParen: boolean = false): boolean {
        if (!this.indentNestedParentheses) {
            return false;
        }
        if (token.containerType !== SqlPrintTokenContainerType.ParenExpression) {
            return false;
        }

        // Look for nested parentheses containers. If present, indent to highlight grouping.
        return previousSiblingWasOpenParen || token.innerTokens.some((child) => this.containsParenExpression(child));
    }

    /**
     * Recursively inspect descendants to find additional parentheses groups.
     * Helps detect complex boolean groups like ((A) OR (B) OR (C)).
     */
    private containsParenExpression(token: SqlPrintToken): boolean {
        if (token.containerType === SqlPrintTokenContainerType.ParenExpression) {
            return true;
        }
        for (const child of token.innerTokens) {
            if (this.containsParenExpression(child)) {
                return true;
            }
        }
        return false;
    }

    private handleJoinClauseToken(token: SqlPrintToken, level: number): void {
        const text = this.applyKeywordCase(token.text);
        // before join clause, add newline when multiline formatting is allowed
        if (this.onelineHelper.shouldInsertJoinNewline(this.insideWithClause)) {
            this.linePrinter.appendNewline(level);
        }
        this.linePrinter.appendText(text);
    }

    /**
     * Decides whether the current container should collapse into a single line.
     */
    private shouldFormatContainerAsOneline(token: SqlPrintToken, shouldIndentNested: boolean): boolean {
        return this.onelineHelper.shouldFormatContainer(token, shouldIndentNested);
    }

    /**
     * Detects an INSERT column list that must stay on a single line.
     */
    private isInsertClauseOneline(parentContainerType?: SqlPrintTokenContainerType): boolean {
        return this.onelineHelper.isInsertClauseOneline(parentContainerType);
    }

    /**
     * Handles space tokens with context-aware filtering.
     * Skips spaces in CommentBlocks when in specific CTE modes to prevent duplication.
     */
    private handleSpaceToken(
        token: SqlPrintToken,
        parentContainerType?: SqlPrintTokenContainerType,
        nextToken?: SqlPrintToken,
        previousToken?: SqlPrintToken,
        priorToken?: SqlPrintToken,
    ): void {
        if (this.smartCommentBlockBuilder && this.smartCommentBlockBuilder.mode === 'line') {
            this.flushSmartCommentBlockBuilder();
        }
        const currentLineText = this.linePrinter.getCurrentLine().text;
        if (this.onelineHelper.shouldSkipInsertClauseSpace(parentContainerType, nextToken, currentLineText)) {
            return;
        }
        if (this.onelineHelper.shouldSkipCommentBlockSpace(parentContainerType, this.insideWithClause)) {
            const currentLine = this.linePrinter.getCurrentLine();
            if (currentLine.text !== '' && !currentLine.text.endsWith(' ')) {
                this.linePrinter.appendText(' ');
            }
            return;
        }
        // Skip redundant spaces before structural parentheses in CREATE TABLE DDL.
        if (this.shouldSkipSpaceBeforeParenthesis(parentContainerType, nextToken, previousToken, priorToken)) {
            return;
        }
        this.linePrinter.appendText(token.text);
    }

    private findPreviousSignificantToken(tokens: SqlPrintToken[], index: number): { token: SqlPrintToken; index: number } | undefined {
        for (let i = index - 1; i >= 0; i--) {
            const candidate = tokens[i];
            if (candidate.type === SqlPrintTokenType.space || candidate.type === SqlPrintTokenType.commentNewline) {
                continue;
            }
            if (candidate.type === SqlPrintTokenType.comment && !this.rendersInlineComments()) {
                continue;
            }
            return { token: candidate, index: i };
        }
        return undefined;
    }

    private shouldSkipSpaceBeforeParenthesis(
        parentContainerType?: SqlPrintTokenContainerType,
        nextToken?: SqlPrintToken,
        previousToken?: SqlPrintToken,
        priorToken?: SqlPrintToken,
    ): boolean {
        if (!nextToken || nextToken.type !== SqlPrintTokenType.parenthesis || nextToken.text !== '(') {
            return false;
        }
        if (!parentContainerType || !this.isCreateTableSpacingContext(parentContainerType)) {
            return false;
        }
        if (!previousToken) {
            return false;
        }

        if (this.isCreateTableNameToken(previousToken, parentContainerType)) {
            return true;
        }

        if (this.isCreateTableConstraintKeyword(previousToken, parentContainerType)) {
            return true;
        }

        if (priorToken && this.isCreateTableConstraintKeyword(priorToken, parentContainerType)) {
            if (this.isIdentifierAttachedToConstraint(previousToken, priorToken, parentContainerType)) {
                return true;
            }
        }

        return false;
    }

    private shouldAlignCreateTableSelect(
        containerType: SqlPrintTokenContainerType | undefined,
        parentContainerType?: SqlPrintTokenContainerType,
    ): boolean {
        return containerType === SqlPrintTokenContainerType.SimpleSelectQuery &&
            parentContainerType === SqlPrintTokenContainerType.CreateTableQuery;
    }

    private isCreateTableSpacingContext(parentContainerType: SqlPrintTokenContainerType): boolean {
        switch (parentContainerType) {
            case SqlPrintTokenContainerType.CreateTableQuery:
            case SqlPrintTokenContainerType.CreateTableDefinition:
            case SqlPrintTokenContainerType.TableConstraintDefinition:
            case SqlPrintTokenContainerType.ColumnConstraintDefinition:
            case SqlPrintTokenContainerType.ReferenceDefinition:
                return true;
            default:
                return false;
        }
    }

    private isCreateTableNameToken(previousToken: SqlPrintToken, parentContainerType: SqlPrintTokenContainerType): boolean {
        if (parentContainerType !== SqlPrintTokenContainerType.CreateTableQuery) {
            return false;
        }

        return previousToken.containerType === SqlPrintTokenContainerType.QualifiedName;
    }

    private isCreateTableConstraintKeyword(token: SqlPrintToken, parentContainerType: SqlPrintTokenContainerType): boolean {
        if (token.type !== SqlPrintTokenType.keyword) {
            return false;
        }

        const text = token.text.toLowerCase();
        if (parentContainerType === SqlPrintTokenContainerType.ReferenceDefinition) {
            return CREATE_TABLE_PAREN_KEYWORDS_WITH_IDENTIFIER.has(text);
        }

        if (CREATE_TABLE_SINGLE_PAREN_KEYWORDS.has(text)) {
            return true;
        }
        if (CREATE_TABLE_MULTI_PAREN_KEYWORDS.has(text)) {
            return true;
        }

        return false;
    }

    private isIdentifierAttachedToConstraint(
        token: SqlPrintToken,
        keywordToken: SqlPrintToken,
        parentContainerType: SqlPrintTokenContainerType,
    ): boolean {
        if (!token) {
            return false;
        }

        if (parentContainerType === SqlPrintTokenContainerType.ReferenceDefinition) {
            return token.containerType === SqlPrintTokenContainerType.QualifiedName &&
                CREATE_TABLE_PAREN_KEYWORDS_WITH_IDENTIFIER.has(keywordToken.text.toLowerCase());
        }

        if (parentContainerType === SqlPrintTokenContainerType.TableConstraintDefinition ||
            parentContainerType === SqlPrintTokenContainerType.ColumnConstraintDefinition) {
            const normalized = keywordToken.text.toLowerCase();
            if (CREATE_TABLE_SINGLE_PAREN_KEYWORDS.has(normalized) ||
                CREATE_TABLE_MULTI_PAREN_KEYWORDS.has(normalized)) {
                return token.containerType === SqlPrintTokenContainerType.IdentifierString;
            }
        }

        return false;
    }

    private printCommentToken(text: string, level: number, parentContainerType?: SqlPrintTokenContainerType): void {
        const trimmed = text.trim();
        if (!trimmed) {
            return;
        }

        if (this.commentStyle === 'smart' && parentContainerType === SqlPrintTokenContainerType.CommentBlock) {
            if (this.handleSmartCommentBlockToken(text, trimmed, level)) {
                return;
            }
        }

        if (this.commentStyle === 'smart') {
            const normalized = this.normalizeCommentForSmart(trimmed);
            if (normalized.lines.length > 1 || normalized.forceBlock) {
                const blockText = this.buildBlockComment(normalized.lines, level);
                this.linePrinter.appendText(blockText);
            } else {
                const content = normalized.lines[0];
                const lineText = content ? `-- ${content}` : '--';
                if (parentContainerType === SqlPrintTokenContainerType.CommentBlock) {
                    this.linePrinter.appendText(lineText);
                    this.pendingLineCommentBreak = this.resolveCommentIndentLevel(level, parentContainerType);
                } else {
                    this.linePrinter.appendText(lineText);
                    const effectiveLevel = this.resolveCommentIndentLevel(level, parentContainerType);
                    this.linePrinter.appendNewline(effectiveLevel);
                }
            }
        } else {
            if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
                if (/\r?\n/.test(trimmed)) {
                    // Keep multi-line block comments intact by normalizing line endings once.
                    const newlineReplacement = this.isOnelineMode() ? ' ' : (typeof this.newline === 'string' ? this.newline : '\n');
                    const normalized = trimmed.replace(/\r?\n/g, newlineReplacement);
                    this.linePrinter.appendText(normalized);
                } else {
                    this.linePrinter.appendText(trimmed);
                }
            } else {
                this.linePrinter.appendText(trimmed);
            }
            if (trimmed.startsWith('--')) {
                if (parentContainerType === SqlPrintTokenContainerType.CommentBlock) {
                    this.pendingLineCommentBreak = this.resolveCommentIndentLevel(level, parentContainerType);
                } else {
                    const effectiveLevel = this.resolveCommentIndentLevel(level, parentContainerType);
                    this.linePrinter.appendNewline(effectiveLevel);
                }
            }
        }
    }

    private handleSmartCommentBlockToken(raw: string, trimmed: string, level: number): boolean {
        if (!this.smartCommentBlockBuilder) {
            if (trimmed === '/*') {
                // Begin assembling a multi-line block comment that is emitted as split tokens
                this.smartCommentBlockBuilder = { lines: [], level, mode: 'block' };
                return true;
            }
            const lineContent = this.extractLineCommentContent(trimmed);
            if (lineContent !== null) {
                this.smartCommentBlockBuilder = {
                    lines: [lineContent],
                    level,
                    mode: 'line',
                };
                return true;
            }
            return false;
        }

        if (this.smartCommentBlockBuilder.mode === 'block') {
            if (trimmed === '*/') {
                const { lines, level: blockLevel } = this.smartCommentBlockBuilder;
                const blockText = this.buildBlockComment(lines, blockLevel);
                this.linePrinter.appendText(blockText);
                this.pendingLineCommentBreak = blockLevel;
                this.smartCommentBlockBuilder = null;
                return true;
            }
            this.smartCommentBlockBuilder.lines.push(this.normalizeSmartBlockLine(raw));
            return true;
        }

        const content = this.extractLineCommentContent(trimmed);
        if (content !== null) {
            this.smartCommentBlockBuilder.lines.push(content);
            return true;
        }

        this.flushSmartCommentBlockBuilder();
        return false;
    }

    private handleCommentBlockContainer(token: SqlPrintToken, level: number, context: CommentRenderContext): void {
        if (this.commentStyle !== 'smart') {
            const rawLines = this.extractRawCommentBlockLines(token);
            if (rawLines.length > 0) {
                const normalizedBlocks = rawLines.map(line => `/* ${line} */`).join(' ');
                const hasTrailingSpace = token.innerTokens?.some(child => child.type === SqlPrintTokenType.space && child.text.includes(' '));
                this.linePrinter.appendText(hasTrailingSpace ? `${normalizedBlocks} ` : normalizedBlocks);
                return;
            }
            for (const child of token.innerTokens) {
                // Force inner comment tokens to render once the block is approved.
                const childContext: CommentRenderContext = {
                    position: context.position,
                    isTopLevelContainer: context.isTopLevelContainer,
                    forceRender: true,
                };
                this.appendToken(child, level, token.containerType, 0, false, childContext, false);
            }
            return;
        }

        const lines = this.collectCommentBlockLines(token);
        if (lines.length === 0 && !this.smartCommentBlockBuilder) {
            // No meaningful content; treat as empty line comment to preserve spacing
            this.smartCommentBlockBuilder = {
                lines: [''],
                level,
                mode: 'line',
            };
            return;
        }

        if (!this.smartCommentBlockBuilder || this.smartCommentBlockBuilder.mode !== 'line') {
            this.smartCommentBlockBuilder = {
                lines: [...lines],
                level,
                mode: 'line',
            };
        } else {
            this.smartCommentBlockBuilder.lines.push(...lines);
        }
    }

    private normalizeSmartBlockLine(raw: string): string {
        // Remove trailing whitespace that only carries formatting artifacts
        let line = raw.replace(/\s+$/g, '');
        if (!line) {
            return '';
        }
        if (line.startsWith('  ')) {
            line = line.slice(2);
        }
        if (line.startsWith('* ')) {
            return line.slice(2);
        }
        if (line === '*') {
            return '';
        }
        if (line.startsWith('*')) {
            return line.slice(1);
        }
        return line;
    }

    private extractLineCommentContent(trimmed: string): string | null {
        if (trimmed.startsWith('--')) {
            return trimmed.slice(2).trimStart();
        }
        if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
            const inner = trimmed.slice(2, -2).trim();
            return inner;
        }
        return null;
    }

    private flushSmartCommentBlockBuilder(): void {
        if (!this.smartCommentBlockBuilder) {
            return;
        }

        const { lines, level, mode } = this.smartCommentBlockBuilder;

        if (mode === 'line') {
            const meaningfulLineCount = lines.filter(line => line.trim() !== '').length;
            if (meaningfulLineCount > 1) {
                const blockText = this.buildBlockComment(lines, level);
                this.linePrinter.appendText(blockText);
            } else {
                const content = lines[0] ?? '';
                const lineText = content ? `-- ${content}` : '--';
                this.linePrinter.appendText(lineText);
            }
            if (!this.isOnelineMode()) {
                this.linePrinter.appendNewline(level);
            }
            this.pendingLineCommentBreak = null;
        }

        this.smartCommentBlockBuilder = null;
    }

    private collectCommentBlockLines(token: SqlPrintToken): string[] {
        const lines: string[] = [];
        let collectingBlock = false;
        for (const child of token.innerTokens ?? []) {
            if (child.type === SqlPrintTokenType.comment) {
                const trimmed = child.text.trim();
                if (trimmed === '/*') {
                    collectingBlock = true;
                    continue;
                }
                if (trimmed === '*/') {
                    collectingBlock = false;
                    continue;
                }
                if (collectingBlock) {
                    lines.push(this.normalizeSmartBlockLine(child.text));
                    continue;
                }
                const content = this.extractLineCommentContent(trimmed);
                if (content !== null) {
                    lines.push(content);
                }
            }
        }
        return lines;
    }

    private extractRawCommentBlockLines(token: SqlPrintToken): string[] {
        const lines: string[] = [];
        let collectingBlock = false;
        for (const child of token.innerTokens ?? []) {
            if (child.type === SqlPrintTokenType.comment) {
                const text = child.text;
                const trimmed = text.trim();
                if (trimmed === '/*') {
                    collectingBlock = true;
                    continue;
                }
                if (trimmed === '*/') {
                    collectingBlock = false;
                    continue;
                }
                if (collectingBlock) {
                    if (trimmed.length > 0) {
                        lines.push(trimmed);
                    }
                    continue;
                }
            }
        }
        return lines;
    }

    private normalizeCommentForSmart(text: string): { lines: string[]; forceBlock: boolean } {
        const trimmed = text.trim();
        let source = trimmed;
        let forceBlock = false;

        if (trimmed.startsWith('--')) {
            source = trimmed.slice(2);
        } else if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
            const inner = trimmed.slice(2, -2);
            const normalizedInner = inner.replace(/\r?\n/g, '\n');
            if (normalizedInner.includes('\n')) {
                forceBlock = true;
                source = inner;
            } else {
                source = inner;
                if (!source.trim()) {
                    source = trimmed;
                }
            }
        }

        const escaped = this.escapeCommentDelimiters(source);
        const normalized = escaped.replace(/\r?\n/g, '\n');
        const rawSegments = normalized.split('\n');
        const processedLines: string[] = [];
        const processedRaw: string[] = [];
        for (const segment of rawSegments) {
            const rawTrimmed = segment.trim();
            const sanitized = this.sanitizeCommentLine(segment);
            if (sanitized.length > 0) {
                processedLines.push(sanitized);
                processedRaw.push(rawTrimmed);
            }
        }
        let lines = processedLines;

        if (lines.length === 0) {
            lines = [''];
        }

        if (!forceBlock && lines.length === 1 && !lines[0] && trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
            const escapedFull = this.escapeCommentDelimiters(trimmed);
            lines = [this.sanitizeCommentLine(escapedFull)];
        }

        if (!forceBlock && lines.length > 1) {
            forceBlock = true;
        }

        lines = lines.map((line, index) => {
            if (/^[-=_+*#]+$/.test(line)) {
                const rawLine = processedRaw[index] ?? line;
                const normalizedRaw = rawLine.replace(/\s+/g, '');
                if (normalizedRaw.length >= line.length) {
                    return normalizedRaw;
                }
            }
            return line;
        });

        return { lines, forceBlock };
    }

    private buildBlockComment(lines: string[], level: number): string {
        if (lines.length <= 1) {
            const content = lines[0] ?? '';
            return content ? `/* ${content} */` : '/* */';
        }
        const newline = this.newline === ' ' ? '\n' : this.newline;
        const currentLevel = this.linePrinter.getCurrentLine()?.level ?? level;
        const baseIndent = this.getIndentString(currentLevel);
        const unitIndent = '  ';
        const innerIndent = baseIndent + unitIndent;
        const body = lines.map(line => `${innerIndent}${line}`).join(newline);
        const closing = `${baseIndent}*/`;
        return `/*${newline}${body}${newline}${closing}`;
    }

    private getIndentString(level: number): string {
        if (level <= 0) {
            return '';
        }
        if (this.indentSize <= 0) {
            return '  '.repeat(level);
        }
        const unit = typeof this.indentChar === 'string' ? this.indentChar : '';
        return unit.repeat(this.indentSize * level);
    }

    private sanitizeCommentLine(content: string): string {
        let sanitized = content;
        sanitized = sanitized.replace(/\u2028|\u2029/g, ' ');
        sanitized = sanitized.replace(/\s+/g, ' ').trim();
        return sanitized;
    }

    private escapeCommentDelimiters(content: string): string {
        return content
            .replace(/\/\*/g, '\\/\\*')
            .replace(/\*\//g, '*\\/');
    }

    private getCommentBaseIndentLevel(level: number, parentContainerType?: SqlPrintTokenContainerType): number {
        if (!parentContainerType) {
            return level;
        }
        const clauseAlignedLevel = this.getClauseBreakIndentLevel(parentContainerType, level);
        return Math.max(level, clauseAlignedLevel);
    }

    private resolveCommentIndentLevel(level: number, parentContainerType?: SqlPrintTokenContainerType): number {
        const baseLevel = this.getCommentBaseIndentLevel(level, parentContainerType);
        const currentLevel = this.linePrinter.getCurrentLine().level ?? baseLevel;
        return Math.max(baseLevel, currentLevel);
    }

    /**
     * Handles commentNewline tokens with conditional newline behavior.
     * In multiline mode (newline !== ' '), adds a newline after comments.
     * In oneliner mode (newline === ' '), does nothing to keep comments on same line.
     * Skips newlines in CTE modes (full-oneline, cte-oneline) to maintain one-line format.
     */
    private handleCommentNewlineToken(token: SqlPrintToken, level: number): void {
        if (this.smartCommentBlockBuilder) {
            return;
        }
        if (this.pendingLineCommentBreak !== null) {
            this.linePrinter.appendNewline(this.pendingLineCommentBreak);
            this.pendingLineCommentBreak = null;
            return;
        }
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

    private shouldAddNewlineBeforeLeadingComments(parentType?: SqlPrintTokenContainerType): boolean {
        if (!parentType) {
            return false;
        }
        if (parentType === SqlPrintTokenContainerType.TupleExpression) {
            return true;
        }
        if (
            parentType === SqlPrintTokenContainerType.InsertClause ||
            parentType === SqlPrintTokenContainerType.MergeInsertAction
        ) {
            return !this.insertColumnsOneLine;
        }
        if (parentType === SqlPrintTokenContainerType.SetClause) {
            return true;
        }
        if (parentType === SqlPrintTokenContainerType.SelectClause) {
            return true;
        }
        if (parentType === SqlPrintTokenContainerType.ExplainStatement) {
            // Ensure EXPLAIN targets print header comments on a dedicated line.
            return true;
        }
        return false;
    }

    private getLeadingCommentIndentLevel(parentType: SqlPrintTokenContainerType | undefined, currentLevel: number): number {
        if (parentType === SqlPrintTokenContainerType.TupleExpression) {
            return currentLevel + 1;
        }
        if (
            parentType === SqlPrintTokenContainerType.InsertClause ||
            parentType === SqlPrintTokenContainerType.MergeInsertAction ||
            parentType === SqlPrintTokenContainerType.SelectClause
        ) {
            return currentLevel + 1;
        }
        if (parentType === SqlPrintTokenContainerType.SetClause) {
            return currentLevel + 1;
        }
        return currentLevel;
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
            orBreak: this.orBreak,
            keywordCase: this.keywordCase,
            exportComment: 'none',
            withClauseStyle: 'standard', // Prevent recursive processing
            indentNestedParentheses: false,
            insertColumnsOneLine: this.insertColumnsOneLine,
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

    private getClauseBreakIndentLevel(parentType: SqlPrintTokenContainerType | undefined, level: number): number {
        if (!parentType) {
            return level;
        }

        switch (parentType) {
            case SqlPrintTokenContainerType.MergeWhenClause:
                // Actions under WHEN clauses should be indented one level deeper than the WHEN line.
                return level + 1;
            case SqlPrintTokenContainerType.MergeUpdateAction:
            case SqlPrintTokenContainerType.MergeDeleteAction:
            case SqlPrintTokenContainerType.MergeInsertAction:
                // Keep MERGE actions and their follow-up keywords (e.g., VALUES, WHERE) aligned with the action keyword.
                return level + 1;
            default:
                return level;
        }
    }

    private isMergeActionContainer(token?: SqlPrintToken): boolean {
        if (!token) {
            return false;
        }
        switch (token.containerType) {
            case SqlPrintTokenContainerType.MergeUpdateAction:
            case SqlPrintTokenContainerType.MergeDeleteAction:
            case SqlPrintTokenContainerType.MergeInsertAction:
            case SqlPrintTokenContainerType.MergeDoNothingAction:
                return true;
            default:
                return false;
        }
    }

    private shouldBreakAfterOpeningParen(parentType?: SqlPrintTokenContainerType): boolean {
        if (!parentType) {
            return false;
        }
        if (
            parentType === SqlPrintTokenContainerType.InsertClause ||
            parentType === SqlPrintTokenContainerType.MergeInsertAction
        ) {
            return !this.isInsertClauseOneline(parentType);
        }
        return false;
    }

    private shouldBreakBeforeClosingParen(parentType?: SqlPrintTokenContainerType): boolean {
        if (!parentType) {
            return false;
        }
        if (
            parentType === SqlPrintTokenContainerType.InsertClause ||
            parentType === SqlPrintTokenContainerType.MergeInsertAction
        ) {
            return !this.isInsertClauseOneline(parentType);
        }
        return false;
    }

    private shouldConvertSpaceToClauseBreak(parentType: SqlPrintTokenContainerType | undefined, nextToken?: SqlPrintToken): boolean {
        if (!parentType || !nextToken) {
            return false;
        }

        const nextKeyword = nextToken.type === SqlPrintTokenType.keyword ? nextToken.text.toLowerCase() : null;
        const nextContainer = nextToken.containerType;

        if (parentType === SqlPrintTokenContainerType.MergeQuery) {
            // Break before USING blocks and before each WHEN clause to mirror statement structure.
            if (nextKeyword === 'using') {
                return true;
            }
            if (nextContainer === SqlPrintTokenContainerType.MergeWhenClause) {
                return true;
            }
        }

        if (parentType === SqlPrintTokenContainerType.MergeWhenClause) {
            // Force the action to start on the next line with additional indentation.
            if (
                nextContainer === SqlPrintTokenContainerType.MergeUpdateAction ||
                nextContainer === SqlPrintTokenContainerType.MergeDeleteAction ||
                nextContainer === SqlPrintTokenContainerType.MergeInsertAction ||
                nextContainer === SqlPrintTokenContainerType.MergeDoNothingAction
            ) {
                return true;
            }
        }

        if (parentType === SqlPrintTokenContainerType.UpdateQuery) {
            if (nextKeyword === 'set' || nextKeyword === 'from' || nextKeyword === 'where' || nextKeyword === 'returning') {
                return true;
            }
        }

        if (parentType === SqlPrintTokenContainerType.InsertQuery) {
            if (nextKeyword === 'returning') {
                return true;
            }
            if (nextKeyword && (nextKeyword.startsWith('select') || nextKeyword.startsWith('values'))) {
                return true;
            }
            if (nextContainer === SqlPrintTokenContainerType.ValuesQuery || nextContainer === SqlPrintTokenContainerType.SimpleSelectQuery) {
                return true;
            }
            if (nextContainer === SqlPrintTokenContainerType.InsertClause) {
                return true;
            }
        }

        if (parentType === SqlPrintTokenContainerType.DeleteQuery) {
            if (nextKeyword === 'using' || nextKeyword === 'where' || nextKeyword === 'returning') {
                return true;
            }
        }

        if (parentType === SqlPrintTokenContainerType.MergeUpdateAction || parentType === SqlPrintTokenContainerType.MergeDeleteAction) {
            if (nextKeyword === 'where') {
                return true;
            }
        }

        if (parentType === SqlPrintTokenContainerType.MergeInsertAction) {
            if (nextKeyword && (nextKeyword.startsWith('values') || nextKeyword === 'default values')) {
                return true;
            }
        }

        return false;
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
            andBreak: 'none',          // Disable AND-based line breaks
            orBreak: 'none',           // Disable OR-based line breaks
            keywordCase: this.keywordCase,
            exportComment: this.commentExportMode,
            commentStyle: this.commentStyle,
            withClauseStyle: 'standard',
            parenthesesOneLine: false, // Prevent recursive processing (avoid infinite loops)
            betweenOneLine: false,     // Prevent recursive processing (avoid infinite loops)
            valuesOneLine: false,      // Prevent recursive processing (avoid infinite loops)
            joinOneLine: false,        // Prevent recursive processing (avoid infinite loops)
            caseOneLine: false,        // Prevent recursive processing (avoid infinite loops)
            subqueryOneLine: false,    // Prevent recursive processing (avoid infinite loops)
            indentNestedParentheses: false,
            insertColumnsOneLine: this.insertColumnsOneLine,
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
