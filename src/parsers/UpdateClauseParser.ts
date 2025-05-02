import { UpdateClause } from "../models/Clause";
import { SourceExpressionParser } from "./SourceExpressionParser";
import { Lexeme } from "../models/Lexeme";

/**
 * Parses the target of an UPDATE statement (table or source expression with optional alias).
 */
export class UpdateClauseParser {
    /**
     * Parse from lexeme array (returns UpdateClause and new index)
     * This method parses a table or a table with alias using SourceExpressionParser.
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: UpdateClause; newIndex: number } {
        // Parse table or table with alias using SourceExpressionParser
        const result = SourceExpressionParser.parseFromLexeme(lexemes, index);
        return { value: new UpdateClause(result.value), newIndex: result.newIndex };
    }
}
