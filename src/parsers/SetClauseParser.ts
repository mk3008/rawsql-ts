// Provides parsing for SET clauses in UPDATE queries.
import { Lexeme, TokenType } from "../models/Lexeme";
import { SetClause, SetClauseItem } from "../models/Clause";
import { ValueParser } from "./ValueParser";

/**
 * Parse SET clause from lexemes (including 'SET' keyword check).
 */
export class SetClauseParser {
    public static parseFromLexeme(lexemes: Lexeme[], idx: number): { setClause: SetClause; newIndex: number } {
        if (lexemes[idx].value !== "set") {
            throw new Error(`Syntax error at position ${idx}: Expected 'SET' but found '${lexemes[idx].value}'.`);
        }

        idx++;
        let setClauseItems: SetClauseItem[] = [];
        while (idx < lexemes.length && lexemes[idx].type === TokenType.Identifier) {
            const column = lexemes[idx].value;
            idx++;

            if (lexemes[idx]?.type !== TokenType.Operator || lexemes[idx].value !== "=") {
                throw new Error(`Syntax error at position ${idx}: Expected '=' after column name in SET clause.`);
            }
            idx++;

            // Value expression (for now, just take the next identifier/literal)
            const value = ValueParser.parseFromLexeme(lexemes, idx);
            setClauseItems.push(new SetClauseItem(column, value.value));
            idx = value.newIndex;

            if (lexemes[idx]?.type === TokenType.Comma) {
                idx++;
            } else {
                break;
            }
        }

        return { setClause: new SetClause(setClauseItems), newIndex: idx };
    }
}
