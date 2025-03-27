import { Distinct, DistinctComponent, DistinctOn, SelectClause, SelectComponent, SelectItem } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class SelectClauseParser {
    public static ParseFromText(query: string): SelectClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.Parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Unexpected token at index ${result.newIndex}: ${lexemes[result.newIndex].value}`);
        }

        return result.value;
    }

    private static Parse(lexemes: Lexeme[], index: number): { value: SelectClause; newIndex: number } {
        let idx = index;
        let distinct: DistinctComponent | null = null;

        if (lexemes[idx].value !== 'select') {
            throw new Error(`Expected 'SELECT' at index ${idx}`);
        }
        idx++;

        if (idx < lexemes.length && lexemes[idx].value === 'distinct') {
            idx++;
            distinct = new Distinct();
        } else if (idx < lexemes.length && lexemes[idx].value === 'distinct on') {
            idx++;
            const argument = ValueParser.ParseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            distinct = new DistinctOn(argument.value);
            idx = argument.newIndex;
        }

        const items: SelectComponent[] = [];
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
            throw new Error(`No select items found at index ${index}`);
        } else {
            const clause = new SelectClause(items, distinct);
            return { value: clause, newIndex: idx };
        }
    }

    private static ParseItem(lexemes: Lexeme[], index: number): { value: SelectComponent; newIndex: number } {
        let idx = index;

        const parsedValue = ValueParser.Parse(lexemes, idx);
        const value = parsedValue.value;
        idx = parsedValue.newIndex;

        if (idx < lexemes.length && lexemes[idx].value === 'as') {
            idx++;
        }

        if (idx < lexemes.length && lexemes[idx].type === TokenType.Identifier) {
            const alias = lexemes[idx].value;
            idx++;
            return {
                value: new SelectItem(value, alias),
                newIndex: idx,
            };
        } else {
            // alias nameless
            return {
                value,
                newIndex: idx,
            };
        }
    }
}