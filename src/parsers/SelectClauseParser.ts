import { Distinct, DistinctComponent, DistinctOn, SelectClause, SelectComponent, SelectItem } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class SelectClauseParser {
    public static parseFromText(query: string): SelectClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The SELECT clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    private static parse(lexemes: Lexeme[], index: number): { value: SelectClause; newIndex: number } {
        let idx = index;
        let distinct: DistinctComponent | null = null;

        if (lexemes[idx].value !== 'select') {
            throw new Error(`Syntax error at position ${idx}: Expected 'SELECT' keyword but found "${lexemes[idx].value}". SELECT clauses must start with the SELECT keyword.`);
        }
        idx++;

        if (idx < lexemes.length && lexemes[idx].value === 'distinct') {
            idx++;
            distinct = new Distinct();
        } else if (idx < lexemes.length && lexemes[idx].value === 'distinct on') {
            idx++;
            const argument = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            distinct = new DistinctOn(argument.value);
            idx = argument.newIndex;
        }

        const items: SelectComponent[] = [];
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
            throw new Error(`Syntax error at position ${index}: No select items found. The SELECT clause requires at least one expression to select.`);
        } else {
            const clause = new SelectClause(items, distinct);
            return { value: clause, newIndex: idx };
        }
    }

    private static parseItem(lexemes: Lexeme[], index: number): { value: SelectComponent; newIndex: number } {
        let idx = index;

        const parsedValue = ValueParser.parse(lexemes, idx);
        const value = parsedValue.value;
        idx = parsedValue.newIndex;

        if (idx < lexemes.length && lexemes[idx].value === 'as') {
            // Skip 'AS' keyword
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