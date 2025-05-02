// Provides parsing for RETURNING clauses in SQL (used in UPDATE, INSERT, DELETE, etc.)
import { Lexeme, TokenType } from "../models/Lexeme";
import { IdentifierString } from "../models/ValueComponent";
import { ReturningClause } from "../models/Clause";

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
        idx++;
        const columns: IdentifierString[] = [];
        while (idx < lexemes.length && lexemes[idx].type === TokenType.Identifier) {
            columns.push(new IdentifierString(lexemes[idx].value));
            idx++;
            if (lexemes[idx]?.type === TokenType.Comma) {
                idx++;
            } else {
                break;
            }
        }
        return { value: new ReturningClause(columns), newIndex: idx };
    }
}
