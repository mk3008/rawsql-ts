import { SelectClause, SelectItem, SelectList } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference } from "../models/ValueComponent";
import { SqlTokenizer } from "./sqlTokenizer";
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

        if (lexemes[idx].value !== 'select') {
            throw new Error(`Expected 'SELECT' at index ${idx}`);
        }
        idx++;

        const items: SelectItem[] = [];
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
        } else if (items.length === 1) {
            const clause = new SelectClause(items[0]);
            return { value: clause, newIndex: idx };
        } else {
            const clause = new SelectClause(new SelectList(items));
            return { value: clause, newIndex: idx };
        }
    }

    private static ParseItem(lexemes: Lexeme[], index: number): { value: SelectItem; newIndex: number } {
        let idx = index;

        const parsedValue = ValueParser.Parse(lexemes, idx);
        const value = parsedValue.value;
        idx = parsedValue.newIndex;

        if (idx < lexemes.length && lexemes[idx].value === 'as') {
            idx++;
        }

        const defaultName = value instanceof ColumnReference
            ? value.column.name
            : null;

        if (idx < lexemes.length && lexemes[idx].type === TokenType.Identifier) {
            const alias = lexemes[idx].value;
            idx++;
            return {
                value: new SelectItem(value, alias),
                newIndex: idx,
            };
        } else if (defaultName) {
            return {
                value: new SelectItem(value, defaultName),
                newIndex: idx,
            };
        }

        throw new Error(`Column name not found at index ${index}`);
    }
}