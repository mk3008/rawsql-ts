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
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: WithClause; newIndex: number } {
        let idx = index;

        // Capture comments from the WITH keyword
        const withTokenComments = idx < lexemes.length ? lexemes[idx].comments : null;

        // Expect WITH keyword
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === "with") {
            idx++;
        } else {
            throw new Error(`Syntax error at position ${idx}: Expected WITH keyword.`);
        }

        // Check for RECURSIVE keyword
        const recursive = idx < lexemes.length && lexemes[idx].value.toLowerCase() === "recursive";
        if (recursive) {
            idx++;
        }

        // Parse CTEs
        const tables: CommonTable[] = [];

        // Parse first CTE (required)
        const firstCte = CommonTableParser.parseFromLexeme(lexemes, idx);
        tables.push(firstCte.value);
        idx = firstCte.newIndex;

        // Parse additional CTEs (optional)
        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++; // Skip comma
            
            // Capture comments that may be before the next CTE name
            // Check if there are tokens before the CTE name that might have comments
            const cteResult = CommonTableParser.parseFromLexeme(lexemes, idx);
            tables.push(cteResult.value);
            idx = cteResult.newIndex;
        }

        // Create WITH clause with comments
        const withClause = new WithClause(recursive, tables);
        withClause.comments = withTokenComments;

        return {
            value: withClause,
            newIndex: idx
        };
    }
}