import { GroupByClause } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { ValueComponent } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class GroupByClauseParser {
    public static ParseFromText(query: string): GroupByClause {
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

    private static Parse(lexemes: Lexeme[], index: number): { value: GroupByClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'group by') {
            throw new Error(`Expected 'GROUP BY' at index ${idx}`);
        }
        idx++;

        const items: ValueComponent[] = [];
        const item = this.ParseItem(lexemes, idx);
        items.push(item.value);
        idx = item.newIndex;

        while (idx < lexemes.length && lexemes[idx].type === TokenType.Comma) {
            idx++;
            const item = this.ParseItem(lexemes, idx);
            items.push(item.value);
            idx = item.newIndex;
        }

        if (items.length === 0) {
            throw new Error(`No group by items found at index ${index}`);
        } else {
            const clause = new GroupByClause(items);
            return { value: clause, newIndex: idx };
        }
    }

    private static ParseItem(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        const parsedValue = ValueParser.Parse(lexemes, idx);
        const value = parsedValue.value;
        idx = parsedValue.newIndex;

        return { value, newIndex: idx };
    }
}