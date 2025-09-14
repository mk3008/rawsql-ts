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

        // Capture comments from the CTE name token and preceding tokens (before parsing alias)
        const cteNameComments = idx < lexemes.length ? lexemes[idx].comments : null;
        const cteNamePositionedComments = idx < lexemes.length ? lexemes[idx].positionedComments : null;

        // Also look for comments in preceding tokens that should belong to this CTE name
        // For SQL like "WITH /* comment */ cte_name AS", the comment appears before the CTE name
        let precedingComments: string[] | null = null;
        let precedingPositionedComments: any[] | null = null;

        // Check previous tokens for comments that should be associated with this CTE
        for (let i = idx - 1; i >= 0; i--) {
            const token = lexemes[i];
            // Stop looking if we hit a comma (indicates previous CTE) or WITH keyword
            if (token.type & TokenType.Comma) {
                break;
            }
            if (token.value.toLowerCase() === 'with' || token.value.toLowerCase() === 'recursive') {
                break;
            }
            // Collect comments from tokens that are just comments or whitespace before the CTE name
            if (token.comments && token.comments.length > 0) {
                if (!precedingComments) precedingComments = [];
                precedingComments.unshift(...token.comments);
            }
            if (token.positionedComments && token.positionedComments.length > 0) {
                if (!precedingPositionedComments) precedingPositionedComments = [];
                precedingPositionedComments.unshift(...token.positionedComments);
            }
        }

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
            // Combine positioned comments from CTE name token and preceding tokens
            let combinedPositionedComments = [];
            if (precedingPositionedComments && precedingPositionedComments.length > 0) {
                combinedPositionedComments.push(...precedingPositionedComments);
            }
            if (cteNamePositionedComments && cteNamePositionedComments.length > 0) {
                combinedPositionedComments.push(...cteNamePositionedComments);
            }

            // Combine legacy comments from CTE name token and preceding tokens
            let combinedComments = [];
            if (precedingComments && precedingComments.length > 0) {
                combinedComments.push(...precedingComments);
            }
            if (cteNameComments && cteNameComments.length > 0) {
                combinedComments.push(...cteNameComments);
            }

            // Convert comments to positioned comments for proper before/after placement
            if (precedingComments || cteNameComments || combinedPositionedComments.length > 0) {
                let positionedComments = [];

                // Comments from preceding tokens should be 'before' the CTE name
                if (precedingComments && precedingComments.length > 0) {
                    positionedComments.push({
                        position: 'before',
                        comments: precedingComments
                    });
                }

                // Comments from the CTE name token itself should be 'after' the CTE name
                if (cteNameComments && cteNameComments.length > 0) {
                    positionedComments.push({
                        position: 'after',
                        comments: cteNameComments
                    });
                }

                // Add any existing positioned comments (merge with existing ones to avoid duplication)
                if (combinedPositionedComments.length > 0) {
                    for (const existingComment of combinedPositionedComments) {
                        // Check if we already have a comment with the same position
                        const existingPositionIndex = positionedComments.findIndex(
                            pc => pc.position === existingComment.position
                        );

                        if (existingPositionIndex >= 0) {
                            // Merge with existing positioned comment of same position
                            positionedComments[existingPositionIndex].comments.push(...existingComment.comments);
                        } else {
                            // Add as new positioned comment
                            positionedComments.push(existingComment);
                        }
                    }
                }

                // Set positioned comments and clear legacy comments
                aliasResult.value.table.positionedComments = positionedComments;
                aliasResult.value.table.comments = null;

                // Clear positioned comments from AliasExpression to prevent duplication
                aliasResult.value.positionedComments = null;
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