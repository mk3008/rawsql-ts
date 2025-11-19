// Provides parsing for RETURNING clauses in SQL (used in UPDATE, INSERT, DELETE, etc.)
import { Lexeme, TokenType } from "../models/Lexeme";
import { ReturningClause, SelectItem } from "../models/Clause";
import { extractLexemeComments } from "./utils/LexemeCommentUtils";
import { SelectItemParser } from "./SelectClauseParser";

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

        const items: SelectItem[] = [];

        // Parse first item
        const firstItemResult = SelectItemParser.parseItem(lexemes, idx);
        items.push(firstItemResult.value);
        idx = firstItemResult.newIndex;

        // Parse subsequent items separated by commas
        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            const commaLexeme = lexemes[idx];
            // We might want to attach comma comments to the previous item or next item
            // SelectItemParser handles its own leading comments, but comma trailing comments might need handling.
            // For simplicity, we let SelectItemParser handle comments attached to the item start.
            // If we want to preserve comma comments precisely, we might need more logic, 
            // but SelectClauseParser doesn't seem to do anything special for comma comments other than skipping them.
            // However, ReturningClauseParser had complex comment handling.
            // Let's rely on SelectItemParser for now as it is robust for SELECT lists.

            idx++; // skip comma
            const itemResult = SelectItemParser.parseItem(lexemes, idx);
            items.push(itemResult.value);
            idx = itemResult.newIndex;
        }

        if (items.length === 0) {
            const position = lexemes[idx]?.position?.startPosition ?? idx;
            throw new Error(`[ReturningClauseParser] Expected a column or '*' after RETURNING at position ${position}.`);
        }

        const clause = new ReturningClause(items);
        if (returningComments.before.length > 0) {
            clause.addPositionedComments("before", returningComments.before);
        }
        // returningComments.after are usually attached to the first item by SelectItemParser if they are immediately before it?
        // Actually extractLexemeComments(returningLexeme) gets comments attached to RETURNING token.
        // If there are comments after RETURNING, they should be attached to the clause or the first item.
        // In the original parser:
        // let pendingBeforeForNext: string[] = [...returningComments.after];
        // And then added to the first column.

        if (returningComments.after.length > 0 && items.length > 0) {
            items[0].addPositionedComments("before", returningComments.after);
        }

        return { value: clause, newIndex: idx };
    }
}
