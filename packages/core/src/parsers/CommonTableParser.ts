import { CommonTable } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { SelectQueryParser } from "./SelectQueryParser";
import { SourceAliasExpressionParser } from "./SourceAliasExpressionParser";

export class CommonTableParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): CommonTable {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The CommonTable definition is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: CommonTable; newIndex: number; trailingComments: string[] | null } {
        let idx = index;

        // Capture comments from the CTE name token (before parsing alias)
        const cteNameComments = idx < lexemes.length ? lexemes[idx].comments : null;
        const cteNamePositionedComments = idx < lexemes.length ? lexemes[idx].positionedComments : null;

        // Parse alias and optional column aliases
        // SourceAliasExpressionParser already handles column aliases if present
        const aliasResult = SourceAliasExpressionParser.parseFromLexeme(lexemes, idx);
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
        
        // Capture comments from the opening parenthesis for the CTE inner query
        const cteQueryComments = lexemes[idx].comments;
        idx++; // Skip opening parenthesis

        const queryResult = SelectQueryParser.parseFromLexeme(lexemes, idx);
        idx = queryResult.newIndex;
        
        // If there are comments from the opening parenthesis, add them to the inner query
        if (cteQueryComments && cteQueryComments.length > 0) {
            if (queryResult.value.comments) {
                // Prepend the CTE query comments to existing comments
                queryResult.value
            } else {
                queryResult.value
            }
        }

        if (idx < lexemes.length && lexemes[idx].type !== TokenType.CloseParen) {
            throw new Error(`Syntax error at position ${idx}: Expected ')' after CTE query but found "${lexemes[idx].value}".`);
        }
        
        // Capture comments from the closing parenthesis - these might be meant for the subsequent query
        const closingParenComments = lexemes[idx].comments;
        idx++; // Skip closing parenthesis

        const value = new CommonTable(queryResult.value, aliasResult.value, materialized);
        
        // Transfer comments to the CTE name (IdentifierString) for proper Value-based comment handling
        if (aliasResult.value && aliasResult.value.table) {
            // Transfer positioned comments from CTE name token to the IdentifierString
            if (cteNamePositionedComments && cteNamePositionedComments.length > 0) {
                aliasResult.value.table.positionedComments = cteNamePositionedComments;
                // Clear legacy comments to prevent duplication
                aliasResult.value.table
            } else if (cteNameComments && cteNameComments.length > 0) {
                // Fallback to legacy comments if no positioned comments
                aliasResult.value.table
            }
        }
        
        // Clear CommonTable comments since they're now on the CTE name
        value

        return { 
            value, 
            newIndex: idx,
            trailingComments: closingParenComments && closingParenComments.length > 0 ? closingParenComments : null
        };
    }
}