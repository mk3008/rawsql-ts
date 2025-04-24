import { NullsSortDirection, OrderByClause, OrderByComponent, OrderByItem, SortDirection } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class OrderByClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): OrderByClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The ORDER BY clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: OrderByClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'order by') {
            throw new Error(`Syntax error at position ${idx}: Expected 'ORDER BY' keyword but found "${lexemes[idx].value}". ORDER BY clauses must start with the ORDER BY keywords.`);
        }
        idx++;

        const items: OrderByComponent[] = [];
        const item = this.parseItem(lexemes, idx);
        items.push(item.value);
        idx = item.newIndex;

        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++;
            const item = this.parseItem(lexemes, idx);
            items.push(item.value);
            idx = item.newIndex;
        }

        if (items.length === 0) {
            throw new Error(`Syntax error at position ${index}: No ordering expressions found. The ORDER BY clause requires at least one expression to order by.`);
        } else {
            const clause = new OrderByClause(items);
            return { value: clause, newIndex: idx };
        }
    }

    private static parseItem(lexemes: Lexeme[], index: number): { value: OrderByComponent; newIndex: number } {
        let idx = index;
        const parsedValue = ValueParser.parseFromLexeme(lexemes, idx);
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
