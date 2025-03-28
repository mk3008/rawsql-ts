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
            throw new Error(`Unexpected token at position ${result.newIndex}: ${lexemes[result.newIndex].value}`);
        }

        return result.value;
    }

    private static parse(lexemes: Lexeme[], index: number): { value: HavingClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'having') {
            throw new Error(`Expected 'HAVING' at index ${idx}`);
        }
        idx++;

        const item = ValueParser.parse(lexemes, idx);
        const clause = new HavingClause(item.value);

        return { value: clause, newIndex: item.newIndex };
    }
}