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
        while (idx < lexemes.length) {
            const lexeme = lexemes[idx];

            // Accept identifiers (column names) as RETURNING targets.
            if (lexeme.type & TokenType.Identifier) {
                columns.push(new IdentifierString(lexeme.value));
                idx++;
            }
            // Accept '*' wildcard which is emitted as an operator token.
            else if (lexeme.value === "*") {
                columns.push(new IdentifierString("*"));
                idx++;
            } else {
                break;
            }

            if (lexemes[idx]?.type === TokenType.Comma) {
                idx++;
                continue;
            }
            break;
        }

        if (columns.length === 0) {
            const position = lexemes[idx]?.position?.startPosition ?? idx;
            throw new Error(`[ReturningClauseParser] Expected a column or '*' after RETURNING at position ${position}.`);
        }

        return { value: new ReturningClause(columns), newIndex: idx };
    }
}
