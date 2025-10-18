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

/**
 * Legacy SELECT-only parser.
 * Prefer using SqlParser as the canonical entry point for multi-statement or mixed-statement workflows.
 */
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

    private static extractUnionTokenComments(unionLexeme: Lexeme): string[] | null {
        const comments: string[] = [];

        if (unionLexeme.positionedComments && unionLexeme.positionedComments.length > 0) {
            for (const posComment of unionLexeme.positionedComments) {
                if (posComment.comments && posComment.comments.length > 0) {
                    comments.push(...posComment.comments);
                }
            }
            unionLexeme.positionedComments = undefined;
        }

        if (unionLexeme.comments && unionLexeme.comments.length > 0) {
            comments.push(...unionLexeme.comments);
            unionLexeme.comments = null;
        }

        return comments.length > 0 ? comments : null;
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
            const unionComments = this.extractUnionTokenComments(operatorLexeme);
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

        // 1. Parse optional WITH clause and collect header comments
        const { withClauseResult, newIndex: withEndIndex, selectQuery: queryTemplate } = this.parseWithClauseAndComments(lexemes, idx);
        idx = withEndIndex;

        // 2. Parse all SQL clauses sequentially
        const { clauses, newIndex: clausesEndIndex, selectTokenComments } = this.parseAllClauses(lexemes, idx, withClauseResult);
        idx = clausesEndIndex;

        // Merge SELECT token comments based on presence of WITH clause
        if (selectTokenComments && selectTokenComments.length > 0) {
            if (withClauseResult) {
                const existingBetween = queryTemplate.betweenClauseComments ?? [];
                const merged = [...existingBetween];
                for (const comment of selectTokenComments) {
                    if (!merged.includes(comment)) {
                        merged.push(comment);
                    }
                }
                queryTemplate.betweenClauseComments = merged;
                queryTemplate.mainSelectPrefixComments = undefined;
            } else {
                const existingHeader = queryTemplate.headerComments ?? [];
                queryTemplate.headerComments = [
                    ...existingHeader,
                    ...selectTokenComments
                ];
            }
        }

        // 3. Create final query with parsed clauses
        const selectQuery = new SimpleSelectQuery({
            withClause: withClauseResult ? withClauseResult.value : null,
            ...clauses
        });

        // 4. Apply collected comments directly to the query
        this.applyCommentsToQuery(selectQuery, queryTemplate, withClauseResult);

        return { value: selectQuery, newIndex: idx };
    }

    // Parse WITH clause and collect header comments
    private static parseWithClauseAndComments(lexemes: Lexeme[], index: number): {
        withClauseResult: any;
        newIndex: number;
        selectQuery: { headerComments?: string[]; betweenClauseComments?: string[]; mainSelectPrefixComments?: string[] }
    } {
        let idx = index;
        let withClauseResult = null;
        const queryTemplate: any = {};

        // Collect header comments before WITH or SELECT
        queryTemplate.headerComments = this.collectHeaderComments(lexemes, idx);

        // Skip to WITH or SELECT token
        while (idx < lexemes.length &&
               lexemes[idx].value.toLowerCase() !== 'with' &&
               lexemes[idx].value.toLowerCase() !== 'select') {
            idx++;
        }

        // Collect 'before' comments from WITH token
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === 'with') {
            this.collectWithTokenHeaderComments(lexemes[idx], queryTemplate);
        }

        // Parse WITH clause if present
        if (idx < lexemes.length && lexemes[idx].value === 'with') {
            withClauseResult = WithClauseParser.parseFromLexeme(lexemes, idx);
            idx = withClauseResult.newIndex;

            // Collect comments between WITH clause and SELECT
            queryTemplate.mainSelectPrefixComments = this.collectMainSelectPrefixComments(lexemes, withClauseResult, idx);
            queryTemplate.betweenClauseComments = this.collectBetweenClauseComments(lexemes, withClauseResult, idx);
        }

        return { withClauseResult, newIndex: idx, selectQuery: queryTemplate };
    }

    // Parse all SQL clauses (SELECT, FROM, WHERE, etc.)
    private static parseAllClauses(lexemes: Lexeme[], index: number, withClauseResult: any): {
        clauses: any;
        newIndex: number;
        selectTokenComments: string[]
    } {
        let idx = index;

        // Find and parse SELECT clause
        idx = this.findMainSelectToken(lexemes, idx, withClauseResult);
        const selectTokenComments = this.collectSelectTokenComments(lexemes, idx);

        const selectClauseResult = SelectClauseParser.parseFromLexeme(lexemes, idx);
        idx = selectClauseResult.newIndex;

        // Parse optional clauses
        const fromClauseResult = this.parseOptionalClause(lexemes, idx, 'from', FromClauseParser);
        idx = fromClauseResult.newIndex;

        const whereClauseResult = this.parseOptionalClause(lexemes, fromClauseResult.newIndex, 'where', WhereClauseParser);
        idx = whereClauseResult.newIndex;

        const groupByClauseResult = this.parseOptionalClause(lexemes, whereClauseResult.newIndex, 'group by', GroupByClauseParser);
        idx = groupByClauseResult.newIndex;

        const havingClauseResult = this.parseOptionalClause(lexemes, groupByClauseResult.newIndex, 'having', HavingClauseParser);
        idx = havingClauseResult.newIndex;

        const windowClauseResult = this.parseOptionalClause(lexemes, havingClauseResult.newIndex, 'window', WindowClauseParser);
        idx = windowClauseResult.newIndex;

        const orderByClauseResult = this.parseOptionalClause(lexemes, windowClauseResult.newIndex, 'order by', OrderByClauseParser);
        idx = orderByClauseResult.newIndex;

        const limitClauseResult = this.parseOptionalClause(lexemes, orderByClauseResult.newIndex, 'limit', LimitClauseParser);
        idx = limitClauseResult.newIndex;

        const offsetClauseResult = this.parseOptionalClause(lexemes, limitClauseResult.newIndex, 'offset', OffsetClauseParser);
        idx = offsetClauseResult.newIndex;

        const fetchClauseResult = this.parseOptionalClause(lexemes, offsetClauseResult.newIndex, 'fetch', FetchClauseParser);
        idx = fetchClauseResult.newIndex;

        const forClauseResult = this.parseOptionalClause(lexemes, fetchClauseResult.newIndex, 'for', ForClauseParser);
        idx = forClauseResult.newIndex;

        const clauses = {
            selectClause: selectClauseResult.value,
            fromClause: fromClauseResult.value,
            whereClause: whereClauseResult.value,
            groupByClause: groupByClauseResult.value,
            havingClause: havingClauseResult.value,
            orderByClause: orderByClauseResult.value,
            windowClause: windowClauseResult.value,
            limitClause: limitClauseResult.value,
            offsetClause: offsetClauseResult.value,
            fetchClause: fetchClauseResult.value,
            forClause: forClauseResult.value
        };

        return { clauses, newIndex: idx, selectTokenComments };
    }

    // Helper to parse optional clauses
    private static parseOptionalClause(lexemes: Lexeme[], index: number, keyword: string, parser: any): { value: any; newIndex: number } {
        if (index < lexemes.length && lexemes[index].value.toLowerCase() === keyword) {
            return parser.parseFromLexeme(lexemes, index);
        }
        return { value: null, newIndex: index };
    }

    // Collect header comments before meaningful tokens
    private static collectHeaderComments(lexemes: Lexeme[], startIndex: number): string[] {
        const headerComments: string[] = [];
        let idx = startIndex;

        while (idx < lexemes.length &&
               lexemes[idx].value.toLowerCase() !== 'with' &&
               lexemes[idx].value.toLowerCase() !== 'select') {

            const token = lexemes[idx];
            if (token.positionedComments) {
                for (const posComment of token.positionedComments) {
                    if (posComment.comments) {
                        headerComments.push(...posComment.comments);
                    }
                }
            }
            if (token.comments && token.comments.length > 0) {
                headerComments.push(...token.comments);
            }
            idx++;
        }

        return headerComments;
    }

    // Collect 'before' positioned comments from WITH token
    private static collectWithTokenHeaderComments(withToken: Lexeme, queryTemplate: any): void {
        if (!withToken.positionedComments) return;

        if (!queryTemplate.headerComments) queryTemplate.headerComments = [];

        const remainingPositioned: typeof withToken.positionedComments = [];

        for (const posComment of withToken.positionedComments) {
            if (posComment.position === 'before' && posComment.comments) {
                queryTemplate.headerComments.push(...posComment.comments);
            } else {
                remainingPositioned.push(posComment);
            }
        }

        withToken.positionedComments = remainingPositioned.length > 0 ? remainingPositioned : undefined;
    }

    // Collect comments between WITH clause and main SELECT
    private static collectMainSelectPrefixComments(lexemes: Lexeme[], withClauseResult: any, currentIndex: number): string[] {
        const mainSelectPrefixComments: string[] = [];

        // Get trailing comments from WITH clause
        if (withClauseResult?.value.trailingComments) {
            mainSelectPrefixComments.push(...withClauseResult.value.trailingComments);
        }

        // Find main SELECT token
        const mainSelectIdx = this.findMainSelectIndex(lexemes, withClauseResult, currentIndex);

        // Scan tokens between WITH end and main SELECT
        if (withClauseResult && mainSelectIdx > withClauseResult.newIndex) {
            for (let tempIdx = withClauseResult.newIndex; tempIdx < mainSelectIdx; tempIdx++) {
                const token = lexemes[tempIdx];
                if (token.positionedComments) {
                    for (const posComment of token.positionedComments) {
                        if (posComment.comments) {
                            mainSelectPrefixComments.push(...posComment.comments);
                        }
                    }
                }
                if (token.comments && token.comments.length > 0) {
                    mainSelectPrefixComments.push(...token.comments);
                }
            }
        }

        return mainSelectPrefixComments;
    }

    // Collect comments between clauses
    private static collectBetweenClauseComments(lexemes: Lexeme[], withClauseResult: any, currentIndex: number): string[] {
        if (!withClauseResult) return [];

        const betweenClauseComments: string[] = [];
        const withEndIndex = withClauseResult.newIndex;
        const scanStartIndex = Math.max(0, withEndIndex - 1);

        for (let i = scanStartIndex; i < currentIndex; i++) {
            const token = lexemes[i];

            if (token.positionedComments && token.positionedComments.length > 0) {
                for (const posComment of token.positionedComments) {
                    if (posComment.comments) {
                        betweenClauseComments.push(...posComment.comments);
                    }
                }
                token.positionedComments = undefined;
            }

            if (token.comments && token.comments.length > 0) {
                betweenClauseComments.push(...token.comments);
                token.comments = null;
            }
        }

        return betweenClauseComments;
    }

    // Find main SELECT token index
    private static findMainSelectIndex(lexemes: Lexeme[], withClauseResult: any, fallbackIndex: number): number {
        if (withClauseResult) {
            for (let i = withClauseResult.newIndex; i < lexemes.length; i++) {
                if (lexemes[i].value.toLowerCase() === 'select') {
                    return i;
                }
            }
        }
        return fallbackIndex;
    }

    // Find and validate main SELECT token
    private static findMainSelectToken(lexemes: Lexeme[], index: number, withClauseResult: any): number {
        const mainSelectIdx = this.findMainSelectIndex(lexemes, withClauseResult, index);

        if (mainSelectIdx >= lexemes.length || lexemes[mainSelectIdx].value !== 'select') {
            throw new Error(`Syntax error at position ${mainSelectIdx}: Expected 'SELECT' keyword but found "${mainSelectIdx < lexemes.length ? lexemes[mainSelectIdx].value : 'end of input'}". SELECT queries must start with the SELECT keyword.`);
        }

        return mainSelectIdx;
    }

    // Collect and clear comments from SELECT token
    private static collectSelectTokenComments(lexemes: Lexeme[], selectIndex: number): string[] {
        const selectToken = lexemes[selectIndex];
        const selectComments: string[] = [];

        if (selectToken.comments && selectToken.comments.length > 0) {
            selectComments.push(...selectToken.comments);
            selectToken.comments = null;
        }

        if (selectToken.positionedComments && selectToken.positionedComments.length > 0) {
            for (const posComment of selectToken.positionedComments) {
                if (posComment.position === 'before' && posComment.comments) {
                    selectComments.push(...posComment.comments);
                }
            }
            selectToken.positionedComments = undefined;
        }

        return selectComments;
    }

    // Apply all collected comments directly to the query
    private static applyCommentsToQuery(selectQuery: SimpleSelectQuery, queryTemplate: any, withClauseResult: any): void {
        // Apply header comments directly
        if (queryTemplate.headerComments?.length > 0) {
            selectQuery.headerComments = queryTemplate.headerComments;
        }

        // Merge helper to avoid duplicate between-clause comments
        const mergeBetweenComments = (source?: string[]) => {
            if (!source || source.length === 0) {
                return;
            }
            const existing = selectQuery.comments ?? [];
            const merged: string[] = [];

            for (const comment of source) {
                if (!merged.includes(comment)) {
                    merged.push(comment);
                }
            }

            for (const comment of existing) {
                if (!merged.includes(comment)) {
                    merged.push(comment);
                }
            }

            selectQuery.comments = merged;
        };

        mergeBetweenComments(queryTemplate.mainSelectPrefixComments);
        mergeBetweenComments(queryTemplate.betweenClauseComments);
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
