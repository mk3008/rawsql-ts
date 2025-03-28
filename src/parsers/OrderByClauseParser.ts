import { NullsSortDirection, OrderByClause, OrderByComponent, OrderByItem, SortDirection } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class OrderByClauseParser {
    public static parseFromText(query: string): OrderByClause {
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

    private static parse(lexemes: Lexeme[], index: number): { value: OrderByClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'order by') {
            throw new Error(`Expected 'ORDER BY' at index ${idx}`);
        }
        idx++;

        const items: OrderByComponent[] = [];
        const item = this.parseItem(lexemes, idx);
        items.push(item.value);
        idx = item.newIndex;

        while (idx < lexemes.length && lexemes[idx].type === TokenType.Comma) {
            idx++;
            const item = this.parseItem(lexemes, idx);
            items.push(item.value);
            idx = item.newIndex;
        }

        if (items.length === 0) {
            throw new Error(`No select items found at index ${index}`);
        } else {
            const clause = new OrderByClause(items);
            return { value: clause, newIndex: idx };
        }
    }

    private static parseItem(lexemes: Lexeme[], index: number): { value: OrderByComponent; newIndex: number } {
        let idx = index;

        const parsedValue = ValueParser.parse(lexemes, idx);
        const value = parsedValue.value;
        idx = parsedValue.newIndex;

        if (idx >= lexemes.length) {
            return { value: value, newIndex: idx };
        }

        // asc, desc
        const sortDirection = idx >= lexemes.length
            ? null
            : lexemes[idx].value === 'asc'
                ? (idx++, SortDirection.Ascending)
                : lexemes[idx].value === 'desc'
                    ? (idx++, SortDirection.Descending)
                    : null;

        // nulls first, nulls last
        const nullsSortDirection = idx >= lexemes.length
            ? null
            : lexemes[idx].value === 'nulls first'
                ? (idx++, NullsSortDirection.First)
                : lexemes[idx].value === 'nulls last'
                    ? (idx++, NullsSortDirection.Last)
                    : null;

        if (sortDirection === null && nullsSortDirection === null) {
            return { value: value, newIndex: idx };
        }

        return { value: new OrderByItem(value, sortDirection, nullsSortDirection), newIndex: idx };
    }
}