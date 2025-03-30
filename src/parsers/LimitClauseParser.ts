import { LimitClause as LimitClause } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class LimitClauseParser {
    public static parseFromText(query: string): LimitClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The LIMIT clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    public static parse(lexemes: Lexeme[], index: number): { value: LimitClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'limit') {
            throw new Error(`Syntax error at position ${idx}: Expected 'LIMIT' keyword but found "${lexemes[idx].value}". LIMIT clauses must start with the LIMIT keyword.`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'LIMIT' keyword. The LIMIT clause requires a numeric expression.`);
        }

        // Parse LIMIT value
        const limitItem = ValueParser.parse(lexemes, idx);
        idx = limitItem.newIndex;

        let offsetItem = null;

        // Check if there is an OFFSET clause
        if (idx < lexemes.length && lexemes[idx].value === 'offset') {
            idx++;

            if (idx >= lexemes.length) {
                throw new Error(`Syntax error: Unexpected end of input after 'OFFSET' keyword. The OFFSET clause requires a numeric expression.`);
            }

            // Parse OFFSET value
            const offsetValueItem = ValueParser.parse(lexemes, idx);
            offsetItem = offsetValueItem.value;
            idx = offsetValueItem.newIndex;
        }

        const clause = new LimitClause(limitItem.value, offsetItem);

        return { value: clause, newIndex: idx };
    }
}