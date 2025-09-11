import { Lexeme } from "../models/Lexeme";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { SelectClauseParser } from "./SelectClauseParser";
import { FromClauseParser } from "./FromClauseParser";
import { WhereClauseParser } from "./WhereClauseParser";
import { GroupByClauseParser } from "./GroupByParser";
import { HavingClauseParser } from "./HavingParser";
import { OrderByClauseParser } from "./OrderByClauseParser";
import { WindowClauseParser } from "./WindowClauseParser";
import { LimitClauseParser } from "./LimitClauseParser";
import { ForClauseParser } from "./ForClauseParser";
import { SqlTokenizer } from "./SqlTokenizer";
import { WithClauseParser } from "./WithClauseParser";
import { ValuesQueryParser } from "./ValuesQueryParser";
import { FetchClauseParser } from "./FetchClauseParser";
import { OffsetClauseParser } from "./OffsetClauseParser";
import { CTERegionDetector } from "../utils/CTERegionDetector";

export interface ParseAnalysisResult {
    success: boolean;
    query?: SelectQuery;
    error?: string;
    errorPosition?: number; // Character position in source text
    remainingTokens?: string[];
}

export class SelectQueryParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): SelectQuery {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`[SelectQueryParser] Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The SELECT query is complete but there are additional tokens.`);
        }

        return result.value;
    }

    /**
     * Analyzes SQL string for parsing without throwing errors.
     * Returns a result object containing the parsed query on success,
     * or error information if parsing fails.
     *
     * @param query SQL string to analyze
     * @returns Analysis result containing query, error information, and success status
     */
    /**
     * Calculate character position from token index by finding token in original query
     */
    private static calculateCharacterPosition(query: string, lexemes: Lexeme[], tokenIndex: number): number {
        if (tokenIndex >= lexemes.length) {
            return query.length;
        }
        
        // If lexeme has position information, use it
        const lexeme = lexemes[tokenIndex];
        if (lexeme.position?.startPosition !== undefined) {
            return lexeme.position.startPosition;
        }
        
        // Fallback: search for token in original query
        // Build search pattern from tokens up to the target
        let searchStart = 0;
        for (let i = 0; i < tokenIndex; i++) {
            const tokenValue = lexemes[i].value;
            const tokenPos = query.indexOf(tokenValue, searchStart);
            if (tokenPos !== -1) {
                searchStart = tokenPos + tokenValue.length;
            }
        }
        
        const targetToken = lexemes[tokenIndex].value;
        const tokenPos = query.indexOf(targetToken, searchStart);
        return tokenPos !== -1 ? tokenPos : searchStart;
    }

    public static analyze(query: string): ParseAnalysisResult {
        let lexemes: Lexeme[] = [];
        
        try {
            const tokenizer = new SqlTokenizer(query);
            lexemes = tokenizer.readLexmes();

            // Parse
            const result = this.parseFromLexeme(lexemes, 0);

            // Check for remaining tokens
            if (result.newIndex < lexemes.length) {
                const remainingTokens = lexemes.slice(result.newIndex).map(lex => lex.value);
                const errorLexeme = lexemes[result.newIndex];
                const errorPosition = this.calculateCharacterPosition(query, lexemes, result.newIndex);
                
                return {
                    success: false,
                    query: result.value,
                    error: `Syntax error: Unexpected token "${errorLexeme.value}" at character position ${errorPosition}. The SELECT query is complete but there are additional tokens.`,
                    errorPosition: errorPosition,
                    remainingTokens: remainingTokens
                };
            }

            return {
                success: true,
                query: result.value
            };
        } catch (error) {
            // Extract position information from error message if available
            let errorPosition: number | undefined;
            
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Try to extract token index from error message and convert to character position
            const positionMatch = errorMessage.match(/position (\d+)/);
            if (positionMatch) {
                const tokenIndex = parseInt(positionMatch[1], 10);
                errorPosition = this.calculateCharacterPosition(query, lexemes, tokenIndex);
            }

            return {
                success: false,
                error: errorMessage,
                errorPosition: errorPosition
            };
        }
    }

    /**
     * Asynchronously parse SQL string to AST.
     * This method wraps the synchronous parse logic in a Promise for future extensibility.
     * @param query SQL string to parse
     * @returns Promise<SelectQuery>
     */
    public static async parseAsync(query: string): Promise<SelectQuery> {
        // For now, just wrap the sync parse in a resolved Promise
        return Promise.resolve(this.parse(query));
    }

    private static unionCommandSet = new Set<string>([
        "union",
        "union all",
        "intersect",
        "intersect all",
        "except",
        "except all",
    ]);
    private static selectCommandSet = new Set<string>(["with", "select"]);

    /**
     * Transfer headerComments from source query to target query and clear from source
     * @param source Source query to transfer headerComments from
     * @param target Target query to receive headerComments
     */
    private static transferHeaderComments(source: SelectQuery, target: SelectQuery): void {
        if (source.headerComments) {
            target.headerComments = source.headerComments;
            // Clear headerComments from the source query to avoid duplication
            source.headerComments = null;
        }
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: SelectQuery; newIndex: number } {
        let idx = index;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input at position ${index}.`);
        }

        // Check if the first token is a SELECT keyword or VALUES
        const firstToken = lexemes[idx].value;
        if (!this.selectCommandSet.has(firstToken) && firstToken !== 'values') {
            throw new Error(`Syntax error at position ${idx}: Expected 'SELECT' or 'VALUES' keyword but found "${lexemes[idx].value}".`);
        }

        let firstResult = this.selectCommandSet.has(firstToken)
            ? this.parseSimpleSelectQuery(lexemes, idx)
            : this.parseValuesQuery(lexemes, idx);

        let query: SelectQuery = firstResult.value;
        idx = firstResult.newIndex;

        // check 'union'
        while (idx < lexemes.length && this.unionCommandSet.has(lexemes[idx].value.toLowerCase())) {
            const operatorLexeme = lexemes[idx];
            const operator = operatorLexeme.value.toLowerCase();
            const unionComments = operatorLexeme.comments; // Comments from UNION keyword
            idx++;
            if (idx >= lexemes.length) {
                throw new Error(`Syntax error at position ${idx}: Expected a query after '${operator.toUpperCase()}' but found end of input.`);
            }

            const nextToken = lexemes[idx].value.toLowerCase();
            if (this.selectCommandSet.has(nextToken)) {
                const result = this.parseSimpleSelectQuery(lexemes, idx);
                const binaryQuery = new BinarySelectQuery(query, operator, result.value);
                
                // Transfer headerComments from the first query to the BinarySelectQuery
                this.transferHeaderComments(query, binaryQuery);
                
                // Assign UNION comments to right query as headerComments (semantic positioning)
                if (unionComments && unionComments.length > 0) {
                    if (result.value.headerComments) {
                        // Prepend UNION comments to existing headerComments
                        result.value.headerComments = [...unionComments, ...result.value.headerComments];
                    } else {
                        result.value.headerComments = unionComments;
                    }
                }
                
                query = binaryQuery;
                idx = result.newIndex;
            } else if (nextToken === 'values') {
                const result = this.parseValuesQuery(lexemes, idx);
                const binaryQuery = new BinarySelectQuery(query, operator, result.value);
                
                // Transfer headerComments from the first query to the BinarySelectQuery
                this.transferHeaderComments(query, binaryQuery);
                
                // Assign UNION comments to the right side query as headerComments (semantic positioning)
                if (unionComments && unionComments.length > 0) {
                    if (result.value.headerComments) {
                        result.value.headerComments = [...unionComments, ...result.value.headerComments];
                    } else {
                        result.value.headerComments = unionComments;
                    }
                }
                
                query = binaryQuery;
                idx = result.newIndex;
            } else {
                throw new Error(`Syntax error at position ${idx}: Expected 'SELECT' or 'VALUES' after '${operator.toUpperCase()}' but found "${lexemes[idx].value}".`);
            }
        }

        return { value: query, newIndex: idx };
    }

    private static parseSimpleSelectQuery(lexemes: Lexeme[], index: number): { value: SimpleSelectQuery; newIndex: number } {
        let idx = index;
        let withClauseResult = null;

        // Collect headerComments before WITH clause or SELECT clause
        const headerComments: string[] = [];
        
        // headerComments will be collected from SELECT token itself or WITH clause
        
        // Parse optional WITH clause
        if (idx < lexemes.length && lexemes[idx].value === 'with') {
            withClauseResult = WithClauseParser.parseFromLexeme(lexemes, idx);
            idx = withClauseResult.newIndex;
            
            // Collect headerComments from WithClauseParser
            if (withClauseResult.headerComments) {
                headerComments.push(...withClauseResult.headerComments);
            }
        }

        // Collect comments from WITH clause 
        const withTrailingComments: string[] = [];
        
        // Get trailing comments from WITH clause (these are comments after WITH clause, meant for main query)
        if (withClauseResult?.value.trailingComments) {
            withTrailingComments.push(...withClauseResult.value.trailingComments);
        }
        
        // Collect comments that appear between WITH clause end and SELECT keyword
        // These should be applied to query level (appearing between WITH and SELECT)
        const queryLevelComments: string[] = [...withTrailingComments];
        let tempIdx = idx;
        while (tempIdx < lexemes.length && lexemes[tempIdx].value.toLowerCase() !== 'select') {
            const tokenComments = lexemes[tempIdx].comments;
            if (tokenComments && tokenComments.length > 0) {
                queryLevelComments.push(...tokenComments);
            }
            tempIdx++;
        }

        // Parse SELECT clause (required)
        if (idx >= lexemes.length || lexemes[idx].value !== 'select') {
            throw new Error(`Syntax error at position ${idx}: Expected 'SELECT' keyword but found "${idx < lexemes.length ? lexemes[idx].value : 'end of input'}". SELECT queries must start with the SELECT keyword.`);
        }

        // Also collect comments attached to the SELECT token itself as headerComments
        const selectTokenComments = lexemes[idx].comments;
        if (selectTokenComments && selectTokenComments.length > 0) {
            headerComments.push(...selectTokenComments);
            // Clear the comments from the SELECT token to avoid duplication
            lexemes[idx].comments = null;
        }

        const selectClauseResult = SelectClauseParser.parseFromLexeme(lexemes, idx);
        idx = selectClauseResult.newIndex;


        // Parse FROM clause (optional)
        let fromClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'from') {
            fromClauseResult = FromClauseParser.parseFromLexeme(lexemes, idx);
            idx = fromClauseResult.newIndex;
        }

        // Parse WHERE clause (optional)
        let whereClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'where') {
            whereClauseResult = WhereClauseParser.parseFromLexeme(lexemes, idx);
            idx = whereClauseResult.newIndex;
        }

        // Parse GROUP BY clause (optional)
        let groupByClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'group by') {
            groupByClauseResult = GroupByClauseParser.parseFromLexeme(lexemes, idx);
            idx = groupByClauseResult.newIndex;
        }

        // Parse HAVING clause (optional)
        let havingClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'having') {
            havingClauseResult = HavingClauseParser.parseFromLexeme(lexemes, idx);
            idx = havingClauseResult.newIndex;
        }

        // Parse WINDOW clause (optional)
        let windowClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'window') {
            windowClauseResult = WindowClauseParser.parseFromLexeme(lexemes, idx);
            idx = windowClauseResult.newIndex;
        }

        // Parse ORDER BY clause (optional)
        let orderByClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'order by') {
            orderByClauseResult = OrderByClauseParser.parseFromLexeme(lexemes, idx);
            idx = orderByClauseResult.newIndex;
        }

        // Parse LIMIT clause (optional)
        let limitClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'limit') {
            limitClauseResult = LimitClauseParser.parseFromLexeme(lexemes, idx);
            idx = limitClauseResult.newIndex;
        }

        // Parse OFFSET clause (optional)
        let offsetClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'offset') {
            offsetClauseResult = OffsetClauseParser.parseFromLexeme(lexemes, idx);
            idx = offsetClauseResult.newIndex;
        }

        // Parse FETCH clause (optional)
        let fetchClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'fetch') {
            fetchClauseResult = FetchClauseParser.parseFromLexeme(lexemes, idx);
            idx = fetchClauseResult.newIndex;
        }

        // Parse FOR clause (optional)
        let forClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === 'for') {
            forClauseResult = ForClauseParser.parseFromLexeme(lexemes, idx);
            idx = forClauseResult.newIndex;
        }

        // Create and return the SelectQuery object
        const selectQuery = new SimpleSelectQuery({
            withClause: withClauseResult ? withClauseResult.value : null,
            selectClause: selectClauseResult.value,
            fromClause: fromClauseResult ? fromClauseResult.value : null,
            whereClause: whereClauseResult ? whereClauseResult.value : null,
            groupByClause: groupByClauseResult ? groupByClauseResult.value : null,
            havingClause: havingClauseResult ? havingClauseResult.value : null,
            orderByClause: orderByClauseResult ? orderByClauseResult.value : null,
            windowClause: windowClauseResult ? windowClauseResult.value : null,
            limitClause: limitClauseResult ? limitClauseResult.value : null,
            offsetClause: offsetClauseResult ? offsetClauseResult.value : null,
            fetchClause: fetchClauseResult ? fetchClauseResult.value : null,
            forClause: forClauseResult ? forClauseResult.value : null
        });

        // Set headerComments and query-level comments from collected sources to the query object
        selectQuery.comments = queryLevelComments.length > 0 ? queryLevelComments : null;
        selectQuery.headerComments = headerComments.length > 0 ? headerComments : null;

        return { value: selectQuery, newIndex: idx };
    }

    private static parseValuesQuery(lexemes: Lexeme[], index: number): { value: SelectQuery; newIndex: number } {
        // Use ValuesQueryParser to parse VALUES clause
        const result = ValuesQueryParser.parseFromLexeme(lexemes, index);

        // Return the result from ValuesQueryParser directly
        return { value: result.value, newIndex: result.newIndex };
    }

    /**
     * Get the CTE name at the specified cursor position.
     * 
     * This method provides a simple interface for retrieving the CTE name
     * based on a 1D cursor position in the SQL text.
     * 
     * @deprecated Use CTERegionDetector.getCursorCte() instead for better API consistency
     * @param sql - The SQL string to analyze
     * @param cursorPosition - The cursor position (0-based character offset)
     * @returns The CTE name if cursor is in a CTE, null otherwise
     * 
     * @example
     * ```typescript
     * const sql = `WITH users AS (SELECT * FROM table) SELECT * FROM users`;
     * const cteName = SelectQueryParser.getCursorCte(sql, 25);
     * console.log(cteName); // "users"
     * ```
     */
    public static getCursorCte(sql: string, cursorPosition: number): string | null {
        return CTERegionDetector.getCursorCte(sql, cursorPosition);
    }

    /**
     * Get the CTE name at the specified 2D coordinates (line, column).
     * 
     * This method provides a convenient interface for editor integrations
     * that work with line/column coordinates instead of character positions.
     * 
     * @deprecated Use CTERegionDetector.getCursorCteAt() instead for better API consistency
     * @param sql - The SQL string to analyze
     * @param line - The line number (1-based)
     * @param column - The column number (1-based)
     * @returns The CTE name if cursor is in a CTE, null otherwise
     * 
     * @example
     * ```typescript
     * const sql = `WITH users AS (\n  SELECT * FROM table\n) SELECT * FROM users`;
     * const cteName = SelectQueryParser.getCursorCteAt(sql, 2, 5);
     * console.log(cteName); // "users"
     * ```
     */
    public static getCursorCteAt(sql: string, line: number, column: number): string | null {
        return CTERegionDetector.getCursorCteAt(sql, line, column);
    }

    /**
     * Convert character position to line/column coordinates.
     * 
     * @deprecated Use CTERegionDetector.positionToLineColumn() instead for better API consistency
     * @param text - The text to analyze
     * @param position - The character position (0-based)
     * @returns Object with line and column (1-based), or null if invalid position
     */
    public static positionToLineColumn(text: string, position: number): { line: number; column: number } | null {
        return CTERegionDetector.positionToLineColumn(text, position);
    }
}