import { HavingClause } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class HavingClauseParser {
    public static parseFromText(query: string): HavingClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The HAVING clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    public static parse(lexemes: Lexeme[], index: number): { value: HavingClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'having') {
            throw new Error(`Syntax error at position ${idx}: Expected 'HAVING' keyword but found "${lexemes[idx].value}". HAVING clauses must start with the HAVING keyword.`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'HAVING' keyword. The HAVING clause requires a condition expression.`);
        }

        const item = ValueParser.parse(lexemes, idx);
        const clause = new HavingClause(item.value);

        return { value: clause, newIndex: item.newIndex };
    }
}