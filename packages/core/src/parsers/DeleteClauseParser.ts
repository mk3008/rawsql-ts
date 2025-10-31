import { DeleteClause } from "../models/Clause";
import { SourceExpressionParser } from "./SourceExpressionParser";
import { Lexeme } from "../models/Lexeme";
import { extractLexemeComments } from "./utils/LexemeCommentUtils";

/**
 * Parses the target section of a DELETE statement ("DELETE FROM ...").
 */
export class DeleteClauseParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: DeleteClause; newIndex: number } {
        if (index >= lexemes.length) {
            throw new Error(`[DeleteClauseParser] Unexpected end of input at position ${index}: expected 'DELETE FROM'.`);
        }

        const deleteToken = lexemes[index];
        const tokenValue = deleteToken?.value?.toLowerCase();
        if (tokenValue !== "delete from") {
            const position = lexemes[index]?.position?.startPosition ?? index;
            throw new Error(`[DeleteClauseParser] Syntax error at position ${position}: expected 'DELETE FROM' but found '${lexemes[index]?.value}'.`);
        }

        const deleteTokenComments = extractLexemeComments(deleteToken);

        // Skip past the DELETE FROM keyword token so we can parse the target source.
        const targetResult = SourceExpressionParser.parseFromLexeme(lexemes, index + 1);
        const deleteClause = new DeleteClause(targetResult.value);

        // Attach positioned comments captured from the DELETE keyword to the clause.
        if (deleteTokenComments.before.length > 0) {
            deleteClause.addPositionedComments("before", deleteTokenComments.before);
        }
        if (deleteTokenComments.after.length > 0) {
            deleteClause.addPositionedComments("after", deleteTokenComments.after);
        }

        return { value: deleteClause, newIndex: targetResult.newIndex };
    }
}
