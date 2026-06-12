import { NullsSortDirection, OrderByClause, OrderByComponent, OrderByItem, SortDirection } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class OrderByClauseParser {
    private static appendUniqueComments(target: string[] | null, comments: string[] | null | undefined): string[] | null {
        if (!comments || comments.length === 0) {
            return target;
        }

        const merged = target ? [...target] : [];
        for (const comment of comments) {
            if (!merged.includes(comment)) {
                merged.push(comment);
            }
        }
        return merged;
    }

    private static collectLexemeComments(token: Lexeme): string[] | null {
        let comments: string[] | null = null;
        if (token.positionedComments && token.positionedComments.length > 0) {
            for (const posComment of token.positionedComments) {
                comments = this.appendUniqueComments(comments, posComment.comments);
            }
        }
        comments = this.appendUniqueComments(comments, token.comments);
        return comments;
    }

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

        // Capture comments from ASC/DESC/NULLS tokens so they stay adjacent to the full ORDER BY item.
        let orderByItemComments: string[] | null = null;
        let sortDirection: SortDirection | null = null;

        if (idx < lexemes.length) {
            const token = lexemes[idx];
            if (token.value === 'asc') {
                sortDirection = SortDirection.Ascending;
                idx++;
            } else if (token.value === 'desc') {
                sortDirection = SortDirection.Descending;
                idx++;
            }

            // Capture comments from the ASC/DESC token
            if (sortDirection !== null) {
                orderByItemComments = this.appendUniqueComments(orderByItemComments, this.collectLexemeComments(token));
            }
        }

        // nulls first, nulls last
        let nullsSortDirection: NullsSortDirection | null = null;
        if (idx < lexemes.length) {
            const token = lexemes[idx];
            if (token.value === 'nulls first') {
                nullsSortDirection = NullsSortDirection.First;
                idx++;
            } else if (token.value === 'nulls last') {
                nullsSortDirection = NullsSortDirection.Last;
                idx++;
            }

            if (nullsSortDirection !== null) {
                orderByItemComments = this.appendUniqueComments(orderByItemComments, this.collectLexemeComments(token));
            }
        }

        if (sortDirection === null && nullsSortDirection === null) {
            return { value: value, newIndex: idx };
        }

        const item = new OrderByItem(value, sortDirection, nullsSortDirection);
        if (orderByItemComments && orderByItemComments.length > 0) {
            item.comments = orderByItemComments;
        }
        return { value: item, newIndex: idx };
    }
}
