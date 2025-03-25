import { WhereClause } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class WhereClauseParser {
    public static ParseFromText(query: string): WhereClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.Parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Unexpected token at position ${result.newIndex}: ${lexemes[result.newIndex].value}`);
        }

        return result.value;
    }

    private static Parse(lexemes: Lexeme[], index: number): { value: WhereClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'where') {
            throw new Error(`Expected 'WHERE' at index ${idx}`);
        }
        idx++;

        const item = ValueParser.Parse(lexemes, idx);
        const clause = new WhereClause(item.value);

        return { value: clause, newIndex: item.newIndex };
    }
}