import { LimitOffset } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class LimitOffsetParser {
    public static parseFromText(query: string): LimitOffset {
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

    private static parse(lexemes: Lexeme[], index: number): { value: LimitOffset; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'limit') {
            throw new Error(`Expected 'LIMIT' at index ${idx}`);
        }
        idx++;

        // Parse LIMIT value
        const limitItem = ValueParser.parse(lexemes, idx);
        idx = limitItem.newIndex;

        let offsetItem = null;

        // Check if there is an OFFSET clause
        if (idx < lexemes.length && lexemes[idx].value === 'offset') {
            idx++;

            // Parse OFFSET value
            const offsetValueItem = ValueParser.parse(lexemes, idx);
            offsetItem = offsetValueItem.value;
            idx = offsetValueItem.newIndex;
        }

        const clause = new LimitOffset(limitItem.value, offsetItem);

        return { value: clause, newIndex: idx };
    }
}