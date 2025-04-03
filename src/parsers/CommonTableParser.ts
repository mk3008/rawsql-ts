import { CommonTable } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { SelectQueryParser } from "./SelectQueryParser";
import { SourceAliasExpressionParser } from "./SourceAliasExpressionParser";

export class CommonTableParser {
    public static parseFromText(query: string): CommonTable {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The CommonTable definition is complete but there are additional tokens.`);
        }

        return result.value;
    }

    public static parse(lexemes: Lexeme[], index: number): { value: CommonTable; newIndex: number } {
        let idx = index;

        // Parse alias and optional column aliases
        // SourceAliasExpressionParser already handles column aliases if present
        const aliasResult = SourceAliasExpressionParser.parse(lexemes, idx);
        idx = aliasResult.newIndex;

        if (idx < lexemes.length && lexemes[idx].value !== "as") {
            throw new Error(`Syntax error at position ${idx}: Expected 'AS' keyword after CTE name but found "${lexemes[idx].value}".`);
        }
        idx++; // Skip 'AS' keyword

        // Materialized flag
        let materialized: boolean | null = null;

        // Parse optional MATERIALIZED or NOT MATERIALIZED keywords
        if (idx < lexemes.length) {
            const currentValue = lexemes[idx].value;
            if (currentValue === "materialized") {
                materialized = true;
                idx++;
            } else if (currentValue === "not materialized") {
                materialized = false;
                idx++;
            }
        }

        if (idx < lexemes.length && lexemes[idx].type !== TokenType.OpenParen) {
            throw new Error(`Syntax error at position ${idx}: Expected '(' after CTE name but found "${lexemes[idx].value}".`);
        }
        idx++; // Skip opening parenthesis

        const queryResult = SelectQueryParser.parse(lexemes, idx);
        idx = queryResult.newIndex;

        if (idx < lexemes.length && lexemes[idx].type !== TokenType.CloseParen) {
            throw new Error(`Syntax error at position ${idx}: Expected ')' after CTE query but found "${lexemes[idx].value}".`);
        }
        idx++; // Skip closing parenthesis

        const value = new CommonTable(queryResult.value, aliasResult.value, materialized);
        return { value, newIndex: idx };
    }
}