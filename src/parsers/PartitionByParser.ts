import { PartitionByClause } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { ValueComponent } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class PartitionByParser {
    public static parseFromText(query: string): PartitionByClause {
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

    public static parse(lexemes: Lexeme[], index: number): { value: PartitionByClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'partition by') {
            throw new Error(`Expected 'PARTITION BY' at index ${idx}`);
        }
        idx++;

        const items: ValueComponent[] = [];
        const item = ValueParser.parse(lexemes, idx);
        items.push(item.value);
        idx = item.newIndex;

        while (idx < lexemes.length && lexemes[idx].type === TokenType.Comma) {
            idx++;
            const item = ValueParser.parse(lexemes, idx);
            items.push(item.value);
            idx = item.newIndex;
        }

        if (items.length === 0) {
            throw new Error(`No select items found at index ${index}`);
        } else {
            const clause = new PartitionByClause(items);
            return { value: clause, newIndex: idx };
        }
    }
}
