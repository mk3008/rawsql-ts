import { WhereClause } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class WhereClauseParser {
    public static parseFromText(query: string): WhereClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The WHERE clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    private static parse(lexemes: Lexeme[], index: number): { value: WhereClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'where') {
            throw new Error(`Syntax error at position ${idx}: Expected 'WHERE' keyword but found "${lexemes[idx].value}". WHERE clauses must start with the WHERE keyword.`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'WHERE' keyword. The WHERE clause requires a condition expression.`);
        }

        const item = ValueParser.parse(lexemes, idx);
        const clause = new WhereClause(item.value);

        return { value: clause, newIndex: item.newIndex };
    }
}