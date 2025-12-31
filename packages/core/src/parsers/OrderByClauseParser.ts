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

        // Capture comments from ASC/DESC tokens (both legacy comments and positioned comments)
        let sortDirectionComments: string[] | null = null;
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
                if (token.positionedComments && token.positionedComments.length > 0) {
                    sortDirectionComments = [];
                    for (const posComment of token.positionedComments) {
                        if (posComment.comments && posComment.comments.length > 0) {
                            sortDirectionComments.push(...posComment.comments);
                        }
                    }
                }
                if (token.comments && token.comments.length > 0) {
                    if (!sortDirectionComments) sortDirectionComments = [];
                    sortDirectionComments.push(...token.comments);
                }
            }
        }

        // nulls first, nulls last
        const nullsSortDirection = idx >= lexemes.length
            ? null
            : lexemes[idx].value === 'nulls first'
                ? (idx++, NullsSortDirection.First)
                : lexemes[idx].value === 'nulls last'
                    ? (idx++, NullsSortDirection.Last)
                    : null;

        // Apply sort direction comments to the value if captured
        if (sortDirectionComments && sortDirectionComments.length > 0) {
            if (value.comments) {
                value.comments.push(...sortDirectionComments);
            } else {
                value.comments = sortDirectionComments;
            }
        }

        if (sortDirection === null && nullsSortDirection === null) {
            return { value: value, newIndex: idx };
        }

        return { value: new OrderByItem(value, sortDirection, nullsSortDirection), newIndex: idx };
    }
}
