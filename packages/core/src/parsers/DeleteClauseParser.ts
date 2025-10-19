import { DeleteClause } from "../models/Clause";
import { SourceExpressionParser } from "./SourceExpressionParser";
import { Lexeme } from "../models/Lexeme";

/**
 * Parses the target section of a DELETE statement ("DELETE FROM ...").
 */
export class DeleteClauseParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: DeleteClause; newIndex: number } {
        if (index >= lexemes.length) {
            throw new Error(`[DeleteClauseParser] Unexpected end of input at position ${index}: expected 'DELETE FROM'.`);
        }

        const tokenValue = lexemes[index]?.value?.toLowerCase();
        if (tokenValue !== "delete from") {
            const position = lexemes[index]?.position?.startPosition ?? index;
            throw new Error(`[DeleteClauseParser] Syntax error at position ${position}: expected 'DELETE FROM' but found '${lexemes[index]?.value}'.`);
        }

        // Skip past the DELETE FROM keyword token so we can parse the target source.
        const targetResult = SourceExpressionParser.parseFromLexeme(lexemes, index + 1);
        return { value: new DeleteClause(targetResult.value), newIndex: targetResult.newIndex };
    }
}
