import { SqlPrintToken, SqlPrintTokenContainerType, SqlPrintTokenType } from "../models/SqlPrintToken";
import type { WithClauseStyle } from "./SqlFormatter";

export type CommaBreakStyle = 'none' | 'before' | 'after';

export interface OnelineFormattingOptions {
    parenthesesOneLine: boolean;
    betweenOneLine: boolean;
    valuesOneLine: boolean;
    joinOneLine: boolean;
    caseOneLine: boolean;
    subqueryOneLine: boolean;
    insertColumnsOneLine: boolean;
    withClauseStyle: WithClauseStyle;
}

interface FormatInsertClauseResult {
    handled: boolean;
    text?: string;
}

export class OnelineFormattingHelper {
    constructor(private readonly options: OnelineFormattingOptions) {}

    shouldFormatContainer(token: SqlPrintToken, shouldIndentNested: boolean): boolean {
        switch (token.containerType) {
            case SqlPrintTokenContainerType.ParenExpression:
                return this.options.parenthesesOneLine && !shouldIndentNested;
            case SqlPrintTokenContainerType.BetweenExpression:
                return this.options.betweenOneLine;
            case SqlPrintTokenContainerType.Values:
                return this.options.valuesOneLine;
            case SqlPrintTokenContainerType.JoinOnClause:
                return this.options.joinOneLine;
            case SqlPrintTokenContainerType.CaseExpression:
                return this.options.caseOneLine;
            case SqlPrintTokenContainerType.InlineQuery:
                return this.options.subqueryOneLine;
            default:
                return false;
        }
    }

    isInsertClauseOneline(parentContainerType?: SqlPrintTokenContainerType): boolean {
        if (!this.options.insertColumnsOneLine) {
            return false;
        }
        return parentContainerType === SqlPrintTokenContainerType.InsertClause ||
            parentContainerType === SqlPrintTokenContainerType.MergeInsertAction;
    }

    shouldInsertJoinNewline(insideWithClause: boolean): boolean {
        return !(insideWithClause && this.options.withClauseStyle === 'full-oneline');
    }

    resolveCommaBreak(
        parentContainerType: SqlPrintTokenContainerType | undefined,
        commaBreak: CommaBreakStyle,
        cteCommaBreak: CommaBreakStyle,
        valuesCommaBreak: CommaBreakStyle,
    ): CommaBreakStyle {
        if (parentContainerType === SqlPrintTokenContainerType.WithClause) {
            return cteCommaBreak;
        }
        if (parentContainerType === SqlPrintTokenContainerType.AnalyzeStatement) {
            // Keep ANALYZE column lists compact so comma break preferences do not insert newlines.
            return 'none';
        }
        if (parentContainerType === SqlPrintTokenContainerType.Values) {
            return valuesCommaBreak;
        }
        if (this.isInsertClauseOneline(parentContainerType)) {
            return 'none';
        }
        return commaBreak;
    }

    shouldSkipInsertClauseSpace(
        parentContainerType: SqlPrintTokenContainerType | undefined,
        nextToken: SqlPrintToken | undefined,
        currentLineText: string,
    ): boolean {
        const isInsertContainer =
            parentContainerType === SqlPrintTokenContainerType.InsertClause ||
            parentContainerType === SqlPrintTokenContainerType.MergeInsertAction;

        if (!isInsertContainer) {
            return false;
        }

        if (nextToken && nextToken.type === SqlPrintTokenType.parenthesis && nextToken.text === '(') {
            return true;
        }

        if (!this.options.insertColumnsOneLine) {
            return false;
        }

        const lastChar = currentLineText.slice(-1);
        return lastChar === '(' || lastChar === ' ' || lastChar === '';
    }

    shouldSkipCommentBlockSpace(
        parentContainerType: SqlPrintTokenContainerType | undefined,
        insideWithClause: boolean,
    ): boolean {
        return parentContainerType === SqlPrintTokenContainerType.CommentBlock &&
            insideWithClause &&
            this.options.withClauseStyle === 'full-oneline';
    }

    formatInsertClauseToken(
        text: string,
        parentContainerType: SqlPrintTokenContainerType | undefined,
        currentLineText: string,
        ensureTrailingSpace: () => void,
    ): FormatInsertClauseResult {
        if (!this.isInsertClauseOneline(parentContainerType)) {
            return { handled: false };
        }

        if (text === '') {
            return { handled: true };
        }

        const leadingWhitespace = text.match(/^\s+/)?.[0] ?? '';
        const trimmed = leadingWhitespace ? text.slice(leadingWhitespace.length) : text;

        if (trimmed === '') {
            return { handled: true };
        }

        if (leadingWhitespace) {
            const lastChar = currentLineText.slice(-1);
            if (lastChar !== '(' && lastChar !== ' ' && lastChar !== '') {
                ensureTrailingSpace();
            }
        }

        return { handled: true, text: trimmed };
    }
}
