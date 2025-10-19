import { DeleteClause } from "../models/Clause";
import { SourceExpressionParser } from "./SourceExpressionParser";
import { Lexeme } from "../models/Lexeme";

/**
 * Parses the target section of a DELETE statement ("DELETE FROM ...").
 */
export class DeleteClauseParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: DeleteClause; newIndex: number } {
        if (lexemes[index].value !== "delete from") {
            throw new Error(`Syntax error at position ${index}: Expected 'DELETE FROM' but found '${lexemes[index].value}'.`);
        }

        // Skip past the DELETE FROM keyword token so we can parse the target source.
        const targetResult = SourceExpressionParser.parseFromLexeme(lexemes, index + 1);

        return { value: new DeleteClause(targetResult.value), newIndex: targetResult.newIndex };
    }
}
