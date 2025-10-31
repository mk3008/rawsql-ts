// Provides parsing for SET clauses in UPDATE queries.
import { Lexeme, TokenType } from "../models/Lexeme";
import { SetClause, SetClauseItem } from "../models/Clause";
import { ValueParser } from "./ValueParser";
import { FullNameParser } from "./FullNameParser";
import { extractLexemeComments } from "./utils/LexemeCommentUtils";
import { SqlComponent } from "../models/SqlComponent";

/**
 * Parse SET clause from lexemes (including 'SET' keyword check).
 */
export class SetClauseParser {
    public static parseFromLexeme(lexemes: Lexeme[], idx: number): { setClause: SetClause; newIndex: number } {
        if (lexemes[idx].value !== "set") {
            throw new Error(`Syntax error at position ${idx}: Expected 'SET' but found '${lexemes[idx].value}'.`);
        }

        const setLexeme = lexemes[idx];
        const setKeywordComments = extractLexemeComments(setLexeme);
        idx++;

        const items: SetClauseItem[] = [];
        let pendingBeforeForNext: string[] = [...setKeywordComments.after];

        const mergeUnique = (target: string[], source: string[]): void => {
            for (const comment of source) {
                if (!target.includes(comment)) {
                    target.push(comment);
                }
            }
        };

        const addUniquePositionedComments = (component: SqlComponent, position: 'before' | 'after', comments: string[]): void => {
            if (comments.length === 0) {
                return;
            }
            const existing = component.getPositionedComments(position);
            const newOnes = comments.filter(comment => !existing.includes(comment));
            if (newOnes.length > 0) {
                component.addPositionedComments(position, newOnes);
            }
        };

        while (idx < lexemes.length) {
            const currentLexeme = lexemes[idx];
            if (!currentLexeme) {
                break;
            }

            // Break once we reach the start of the next clause (e.g. WHERE, FROM, RETURNING)
            if (currentLexeme.value === "where" || currentLexeme.value === "from" || currentLexeme.value === "returning") {
                break;
            }

            if (!(currentLexeme.type & (TokenType.Identifier | TokenType.Function | TokenType.Type | TokenType.OpenBracket))) {
                break;
            }

            const columnStartComments = extractLexemeComments(currentLexeme);
            const columnParseResult = FullNameParser.parseFromLexeme(lexemes, idx);
            idx = columnParseResult.newIndex;

            const equalsLexeme = lexemes[idx];
            if (!equalsLexeme || !(equalsLexeme.type & TokenType.Operator) || equalsLexeme.value !== "=") {
                throw new Error(`Syntax error at position ${idx}: Expected '=' after column name in SET clause.`);
            }

            const equalsComments = extractLexemeComments(equalsLexeme);
            idx++;

            // Parse value expression for the assignment.
            const valueParseResult = ValueParser.parseFromLexeme(lexemes, idx);
            idx = valueParseResult.newIndex;

            const setItem = new SetClauseItem(
                { namespaces: columnParseResult.namespaces, column: columnParseResult.name },
                valueParseResult.value
            );

            // Attach comments that should appear before the assignment.
            const beforeComments: string[] = [];
            mergeUnique(beforeComments, pendingBeforeForNext);
            mergeUnique(beforeComments, columnStartComments.before);
            if (beforeComments.length > 0) {
                addUniquePositionedComments(columnParseResult.name, "before", beforeComments);
            }
            pendingBeforeForNext = [];

            // Preserve comments that trail the column identifier itself.
            if (columnStartComments.after.length > 0) {
                const afterComments: string[] = [];
                mergeUnique(afterComments, columnStartComments.after);
                addUniquePositionedComments(columnParseResult.name, "after", afterComments);
            }

            // Comments immediately before '=' belong to the assignment item.
            if (equalsComments.before.length > 0) {
                const equalsBefore: string[] = [];
                mergeUnique(equalsBefore, equalsComments.before);
                addUniquePositionedComments(columnParseResult.name, "after", equalsBefore);
            }

            // Comments captured after '=' should precede the value expression.
            if (equalsComments.after.length > 0) {
                const equalsAfter: string[] = [];
                mergeUnique(equalsAfter, equalsComments.after);
                addUniquePositionedComments(valueParseResult.value, "before", equalsAfter);
            }

            items.push(setItem);

            if (lexemes[idx]?.type === TokenType.Comma) {
                const commaLexeme = lexemes[idx];
                const commaComments = extractLexemeComments(commaLexeme);
                idx++;

                // Comments that appear before the comma belong to the current item.
                if (commaComments.before.length > 0) {
                    const commaBefore: string[] = [];
                    mergeUnique(commaBefore, commaComments.before);
                    addUniquePositionedComments(setItem, "after", commaBefore);
                }

                const nextBefore: string[] = [];
                mergeUnique(nextBefore, commaComments.after);
                pendingBeforeForNext = nextBefore;
                continue;
            }

            break;
        }

        if (pendingBeforeForNext.length > 0 && items.length > 0) {
            const trailingComments: string[] = [];
            mergeUnique(trailingComments, pendingBeforeForNext);
            if (trailingComments.length > 0) {
                addUniquePositionedComments(items[items.length - 1], "after", trailingComments);
            }
        }

        const setClause = new SetClause(items);
        if (setKeywordComments.before.length > 0) {
            setClause.addPositionedComments("before", setKeywordComments.before);
        }

        return { setClause, newIndex: idx };
    }
}
