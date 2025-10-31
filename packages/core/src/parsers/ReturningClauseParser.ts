// Provides parsing for RETURNING clauses in SQL (used in UPDATE, INSERT, DELETE, etc.)
import { Lexeme, TokenType } from "../models/Lexeme";
import { IdentifierString } from "../models/ValueComponent";
import { ReturningClause } from "../models/Clause";
import { extractLexemeComments } from "./utils/LexemeCommentUtils";

export class ReturningClauseParser {
    /**
     * Parse RETURNING clause from lexemes, starting at the given index.
     * Returns a ReturningClause instance and the new index after parsing.
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ReturningClause; newIndex: number } {
        let idx = index;
        if (lexemes[idx]?.value !== "returning") {
            throw new Error(`Syntax error at position ${idx}: Expected 'RETURNING' but found '${lexemes[idx]?.value}'.`);
        }

        const returningLexeme = lexemes[idx];
        const returningComments = extractLexemeComments(returningLexeme);
        idx++;

        const columns: IdentifierString[] = [];
        // Track inline comments that should precede the next returning column.
        let pendingBeforeForNext: string[] = [...returningComments.after];
        while (idx < lexemes.length) {
            const lexeme = lexemes[idx];

            let column: IdentifierString | null = null;
            if (lexeme.type & TokenType.Identifier) {
                column = new IdentifierString(lexeme.value);
            } else if (lexeme.value === "*") {
                column = new IdentifierString("*");
            }

            if (!column) {
                break;
            }

            const columnComments = extractLexemeComments(lexeme);
            const beforeComments: string[] = [];
            if (pendingBeforeForNext.length > 0) {
                beforeComments.push(...pendingBeforeForNext);
            }
            if (columnComments.before.length > 0) {
                beforeComments.push(...columnComments.before);
            }
            if (beforeComments.length > 0) {
                column.addPositionedComments("before", beforeComments);
            }
            if (columnComments.after.length > 0) {
                column.addPositionedComments("after", columnComments.after);
            }

            columns.push(column);
            pendingBeforeForNext = [];
            idx++;

            if (lexemes[idx]?.type === TokenType.Comma) {
                const commaComments = extractLexemeComments(lexemes[idx]);
                pendingBeforeForNext = [...commaComments.after];
                idx++;
                continue;
            }

            break;
        }

        if (pendingBeforeForNext.length > 0 && columns.length > 0) {
            columns[columns.length - 1].addPositionedComments("after", pendingBeforeForNext);
        }

        if (columns.length === 0) {
            const position = lexemes[idx]?.position?.startPosition ?? idx;
            throw new Error(`[ReturningClauseParser] Expected a column or '*' after RETURNING at position ${position}.`);
        }

        const clause = new ReturningClause(columns);
        if (returningComments.before.length > 0) {
            clause.addPositionedComments("before", returningComments.before);
        }

        return { value: clause, newIndex: idx };
    }
}
