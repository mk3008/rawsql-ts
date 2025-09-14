import { CommonTable, WithClause } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { CommonTableParser } from "./CommonTableParser";

/**
 * Parser for SQL WITH clauses (Common Table Expressions - CTEs).
 * Parses only the WITH clause portion of SQL, not the entire query.
 * 
 * **Note**: For most use cases, use `SelectQueryParser` which provides more comprehensive SQL parsing.
 * This parser should only be used for the special case where you need to analyze only the WITH clause portion.
 * 
 * @example
 * ```typescript
 * // Parses only the WITH clause, not the following SELECT
 * const sql = "WITH recursive_cte AS (SELECT 1 as n UNION SELECT n+1 FROM recursive_cte WHERE n < 10)";
 * const withClause = WithClauseParser.parse(sql);
 * console.log(withClause.recursive); // true
 * console.log(withClause.tables.length); // 1
 * ```
 */
export class WithClauseParser {
    /**
     * Parses a SQL string containing only a WITH clause into a WithClause AST.
     * The input should contain only the WITH clause, not the subsequent main query.
     * 
     * @param query - The SQL string containing only the WITH clause
     * @returns The parsed WithClause object
     * @throws Error if the syntax is invalid or there are unexpected tokens after the WITH clause
     * 
     * @example
     * ```typescript
     * // Correct: Only the WITH clause
     * const sql = "WITH users_data AS (SELECT id, name FROM users)";
     * const withClause = WithClauseParser.parse(sql);
     * 
     * // Error: Contains SELECT after WITH clause
     * // const badSql = "WITH users_data AS (SELECT id, name FROM users) SELECT * FROM users_data";
     * ```
     */
    public static parse(query: string): WithClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The WITH clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    /**
     * Parses a WITH clause from an array of lexemes starting at the specified index.
     * 
     * @param lexemes - Array of lexemes to parse from
     * @param index - Starting index in the lexemes array
     * @returns Object containing the parsed WithClause and the new index position
     * @throws Error if the syntax is invalid or WITH keyword is not found
     * 
     * @example
     * ```typescript
     * const tokenizer = new SqlTokenizer("WITH cte AS (SELECT 1)");
     * const lexemes = tokenizer.readLexmes();
     * const result = WithClauseParser.parseFromLexeme(lexemes, 0);
     * console.log(result.value.tables.length); // 1
     * console.log(result.newIndex); // position after the WITH clause
     * ```
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: WithClause; newIndex: number; headerComments: string[] | null } {
        let idx = index;

        // Capture comments from the WITH keyword and separate them using positioned comments
        const withTokenPositionedComments = idx < lexemes.length ? lexemes[idx].positionedComments : null;
        const withTokenLegacyComments = idx < lexemes.length ? lexemes[idx].comments : null;
        let headerComments: string[] | null = null;
        let actualWithComments: string[] | null = null;

        // Extract positioned comments: "before" comments are header comments, "after" comments are WITH-specific
        // Process them in source order: first "before" (global), then "after" (WITH-specific)
        if (withTokenPositionedComments && withTokenPositionedComments.length > 0) {
            // First collect "before" comments (appear before WITH clause)
            for (const posComment of withTokenPositionedComments) {
                if (posComment.position === 'before' && posComment.comments) {
                    if (!headerComments) headerComments = [];
                    headerComments.push(...posComment.comments);
                }
            }
            // Then collect "after" comments (appear after WITH keyword, before CTE)
            for (const posComment of withTokenPositionedComments) {
                if (posComment.position === 'after' && posComment.comments) {
                    if (!actualWithComments) actualWithComments = [];
                    actualWithComments.push(...posComment.comments);
                }
            }
        }

        // Fallback to legacy comments if no positioned comments (for backward compatibility)
        if (!headerComments && !actualWithComments && withTokenLegacyComments && withTokenLegacyComments.length > 0) {
            headerComments = [...withTokenLegacyComments];  // Treat legacy comments as header comments
        }

        // Clear both positioned and legacy comments from WITH token to avoid duplication
        if (idx < lexemes.length) {
            if (withTokenPositionedComments) {
                lexemes[idx].positionedComments = undefined;
            }
            if (withTokenLegacyComments) {
                lexemes[idx].comments = null;
            }
        }

        // Expect WITH keyword
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === "with") {
            idx++;
        } else {
            throw new Error(`Syntax error at position ${idx}: Expected WITH keyword.`);
        }

        // Check for RECURSIVE keyword
        const recursive = idx < lexemes.length && lexemes[idx].value.toLowerCase() === "recursive";
        let recursiveComments: string[] | null = null;
        if (recursive) {
            // Capture comments from RECURSIVE keyword token
            const recursiveTokenPositionedComments = lexemes[idx].positionedComments;
            const recursiveTokenLegacyComments = lexemes[idx].comments;

            // Extract "after" positioned comments from RECURSIVE token
            if (recursiveTokenPositionedComments && recursiveTokenPositionedComments.length > 0) {
                for (const posComment of recursiveTokenPositionedComments) {
                    if (posComment.position === 'after' && posComment.comments) {
                        if (!recursiveComments) recursiveComments = [];
                        recursiveComments.push(...posComment.comments);
                    }
                }
            }

            // Fallback to legacy comments if no positioned comments
            if (!recursiveComments && recursiveTokenLegacyComments && recursiveTokenLegacyComments.length > 0) {
                recursiveComments = [...recursiveTokenLegacyComments];
            }

            // Clear comments from RECURSIVE token to avoid duplication
            if (recursiveTokenPositionedComments) {
                lexemes[idx].positionedComments = undefined;
            }
            if (recursiveTokenLegacyComments) {
                lexemes[idx].comments = null;
            }

            idx++;
        }

        // Parse CTEs
        const tables: CommonTable[] = [];

        // Parse first CTE (required)
        // Pass any comments that appeared after WITH keyword to the first CTE
        // These are comments like "WITH /* comment */ cte_name AS" where comment should belong to CTE
        let firstCteIndex = idx;


        // Inject comments from WITH and RECURSIVE tokens into CTE name token for CommonTableParser
        if ((actualWithComments && actualWithComments.length > 0) || (recursiveComments && recursiveComments.length > 0)) {
            const cteNameTokenIndex = firstCteIndex;
            if (cteNameTokenIndex < lexemes.length) {
                // Clear existing comments on CTE name token to prevent duplication
                if (!lexemes[cteNameTokenIndex].positionedComments) {
                    lexemes[cteNameTokenIndex].positionedComments = [];
                }

                // Add WITH "after" comments as "before" positioned comments (appear before CTE name)
                if (actualWithComments && actualWithComments.length > 0) {
                    lexemes[cteNameTokenIndex].positionedComments.push({
                        position: 'before',
                        comments: actualWithComments
                    });
                }

                // Add RECURSIVE comments as "before" positioned comments (appear before CTE name)
                if (recursiveComments && recursiveComments.length > 0) {
                    lexemes[cteNameTokenIndex].positionedComments.push({
                        position: 'before',
                        comments: recursiveComments
                    });
                }
            }
            // Clear the comments to prevent duplication
            actualWithComments = null;
            recursiveComments = null;
        }

        const firstCte = CommonTableParser.parseFromLexeme(lexemes, firstCteIndex);
        tables.push(firstCte.value);
        idx = firstCte.newIndex;
        
        // Collect trailing comments from all CTEs
        const allTrailingComments: string[] = [];
        if (firstCte.trailingComments) {
            allTrailingComments.push(...firstCte.trailingComments);
        }

        // Parse additional CTEs (optional)
        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++; // Skip comma
            
            // Capture comments that may be before the next CTE name
            // Check if there are tokens before the CTE name that might have comments
            const cteResult = CommonTableParser.parseFromLexeme(lexemes, idx);
            tables.push(cteResult.value);
            idx = cteResult.newIndex;
            
            // Collect trailing comments from this CTE too
            if (cteResult.trailingComments) {
                allTrailingComments.push(...cteResult.trailingComments);
            }
        }

        // Create WITH clause with comments
        const withClause = new WithClause(recursive, tables);
        withClause // Only WITH-specific comments
        
        // Global comments should be handled at SelectQuery level, not here
        
        // Set trailing comments for the main query
        if (allTrailingComments.length > 0) {
            withClause.trailingComments = allTrailingComments;
        }

        return {
            value: withClause,
            newIndex: idx,
            headerComments: headerComments
        };
    }

}