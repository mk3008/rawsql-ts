import { Lexeme, TokenType } from "../models/Lexeme";
import { InlineQuery, ParenExpression, ValueComponent } from "../models/ValueComponent";
import { SelectQueryParser } from "./SelectQueryParser";
import { ValueParser } from "./ValueParser";

export class ParenExpressionParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Detect inline queries that start immediately after an opening parenthesis
        if (idx + 1 < lexemes.length && lexemes[idx].type & TokenType.OpenParen && (
            lexemes[idx + 1].value === "select" ||
            lexemes[idx + 1].value === "values" ||
            lexemes[idx + 1].value === "with"
        )) {
            const openLexeme = lexemes[idx];
            const openPositionedComments = openLexeme.positionedComments
                ? openLexeme.positionedComments.map((comment) => ({
                    position: comment.position,
                    comments: [...comment.comments],
                }))
                : null;
            const openLegacyComments = openLexeme.comments ? [...openLexeme.comments] : null;
            idx += 1; // Skip the '(' token
            const result = SelectQueryParser.parseFromLexeme(lexemes, idx);
            idx = result.newIndex;

            // Validate that the inline query is properly closed
            if (idx >= lexemes.length || lexemes[idx].type !== TokenType.CloseParen) {
                throw new Error(`Expected ')' at index ${idx}, but found ${lexemes[idx].value}`);
            }

            // Capture trailing comments that belong to the inline query wrapper
            const closingLexeme = lexemes[idx];
            const closingLegacyComments = closingLexeme.comments;
            const closingPositionedComments = closingLexeme.positionedComments;
            idx++; // Skip the ')' token

            const value = new InlineQuery(result.value);

            if (openPositionedComments && openPositionedComments.length > 0) {
                // Convert inline query-leading comments from the opening parenthesis into 'before' positioned comments
                const beforeComments = openPositionedComments
                    .filter((comment) => comment.position === 'after' && comment.comments.length > 0)
                    .map((comment) => ({
                        position: 'before' as const,
                        comments: [...comment.comments],
                    }));

                if (beforeComments.length > 0) {
                    value.positionedComments = value.positionedComments
                        ? [...beforeComments, ...value.positionedComments]
                        : beforeComments;
                }
            } else if (openLegacyComments && openLegacyComments.length > 0) {
                // Legacy opening-parenthesis comments also become leading inline query comments
                const beforeCommentBlock = { position: 'before' as const, comments: [...openLegacyComments] };
                value.positionedComments = value.positionedComments
                    ? [beforeCommentBlock, ...value.positionedComments]
                    : [beforeCommentBlock];
            }

            if (closingPositionedComments && closingPositionedComments.length > 0) {
                // Only propagate comments that appear after the closing parenthesis (outside the inline query)
                const afterComments = closingPositionedComments
                    .filter((comment) => comment.position === 'after' && comment.comments.length > 0)
                    .map((comment) => ({
                        position: comment.position,
                        comments: [...comment.comments],
                    }));

                if (afterComments.length > 0) {
                    value.positionedComments = value.positionedComments
                        ? [...value.positionedComments, ...afterComments]
                        : afterComments;
                }
            } else if (closingLegacyComments && closingLegacyComments.length > 0) {
                // Legacy comments are treated as trailing comments on the inline query
                value.comments = closingLegacyComments;
            }

            return { value, newIndex: idx };
        }

        const result = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, index);
        idx = result.newIndex;

        const value = new ParenExpression(result.value);
        return { value, newIndex: idx };
    }
}
