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

        // Extract header comments from WITH token
        const headerComments = this.extractWithTokenHeaderComments(lexemes, idx);

        // Parse WITH keyword
        idx = this.parseWithKeyword(lexemes, idx);

        // Parse optional RECURSIVE keyword
        const { recursive, newIndex: recursiveIndex } = this.parseRecursiveFlag(lexemes, idx);
        idx = recursiveIndex;

        // Parse all CTEs
        const { tables, trailingComments, newIndex: ctesIndex } = this.parseAllCommonTables(lexemes, idx);
        idx = ctesIndex;

        // Create WITH clause and apply trailing comments directly
        const withClause = new WithClause(recursive, tables);
        if (trailingComments.length > 0) {
            withClause.trailingComments = trailingComments;
        }

        return {
            value: withClause,
            newIndex: idx,
            headerComments: headerComments
        };
    }

    // Extract header comments from WITH token
    private static extractWithTokenHeaderComments(lexemes: Lexeme[], index: number): string[] | null {
        if (index >= lexemes.length) return null;

        const withToken = lexemes[index];
        let headerComments: string[] | null = null;

        // Extract positioned comments: only "before" comments are header comments
        if (withToken.positionedComments && withToken.positionedComments.length > 0) {
            for (const posComment of withToken.positionedComments) {
                if (posComment.position === 'before' && posComment.comments) {
                    if (!headerComments) headerComments = [];
                    headerComments.push(...posComment.comments);
                }
            }
        }

        // Fallback to legacy comments if no positioned comments (for backward compatibility)
        if (!headerComments && withToken.comments && withToken.comments.length > 0) {
            headerComments = [...withToken.comments];
        }

        return headerComments;
    }

    // Parse WITH keyword
    private static parseWithKeyword(lexemes: Lexeme[], index: number): number {
        if (index < lexemes.length && lexemes[index].value.toLowerCase() === "with") {
            return index + 1;
        } else {
            throw new Error(`Syntax error at position ${index}: Expected WITH keyword.`);
        }
    }

    // Parse optional RECURSIVE keyword
    private static parseRecursiveFlag(lexemes: Lexeme[], index: number): { recursive: boolean; newIndex: number } {
        const recursive = index < lexemes.length && lexemes[index].value.toLowerCase() === "recursive";
        return {
            recursive,
            newIndex: recursive ? index + 1 : index
        };
    }

    // Parse all common table expressions
    private static parseAllCommonTables(lexemes: Lexeme[], index: number): { tables: CommonTable[]; trailingComments: string[]; newIndex: number } {
        let idx = index;
        const tables: CommonTable[] = [];
        const allTrailingComments: string[] = [];

        // Parse first CTE (required)
        const firstCte = CommonTableParser.parseFromLexeme(lexemes, idx);
        tables.push(firstCte.value);
        idx = firstCte.newIndex;

        // Collect trailing comments from first CTE directly
        if (firstCte.trailingComments) {
            allTrailingComments.push(...firstCte.trailingComments);
        }

        // Parse additional CTEs (optional)
        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++; // Skip comma

            const cteResult = CommonTableParser.parseFromLexeme(lexemes, idx);
            tables.push(cteResult.value);
            idx = cteResult.newIndex;

            // Collect trailing comments from this CTE directly
            if (cteResult.trailingComments) {
                allTrailingComments.push(...cteResult.trailingComments);
            }
        }

        return {
            tables,
            trailingComments: allTrailingComments,
            newIndex: idx
        };
    }

}