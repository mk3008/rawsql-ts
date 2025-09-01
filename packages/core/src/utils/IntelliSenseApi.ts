import { CursorContextAnalyzer, IntelliSenseContext } from './CursorContextAnalyzer';
import { ScopeResolver, ScopeInfo } from './ScopeResolver';
import { PositionAwareParser, ParseToPositionOptions, PositionParseResult } from './PositionAwareParser';
import { MultiQuerySplitter, QueryCollection } from './MultiQuerySplitter';
import { LineColumn } from './LexemeCursor';
import { TextPositionUtils } from './TextPositionUtils';

/**
 * Convenience API for SQL IntelliSense integration
 * 
 * Provides simplified, high-level functions that combine the functionality
 * of the various position-aware parsing components for easy integration
 * with Monaco Editor and other code editors.
 * 
 * @example
 * ```typescript
 * import { parseToPosition, getCursorContext, resolveScope, splitQueries } from 'rawsql-ts';
 * 
 * // Parse incomplete SQL with error recovery
 * const sql = "SELECT u.name FROM users u WHERE u.";
 * const parseResult = parseToPosition(sql, sql.length, { errorRecovery: true });
 * 
 * // Get cursor context for completion suggestions
 * const context = getCursorContext(sql, sql.length);
 * console.log(context.isAfterDot); // true
 * console.log(context.precedingIdentifier); // "u"
 * 
 * // Get scope information for table/column completion
 * const scope = resolveScope(sql, sql.length);
 * console.log(scope.availableTables); // [{ name: 'users', alias: 'u' }]
 * 
 * // Handle multi-query editor
 * const multiSQL = "SELECT 1; SELECT 2;";
 * const queries = splitQueries(multiSQL);
 * const activeQuery = queries.getActive(12); // Get query at position
 * ```
 */

/**
 * Parse SQL up to cursor position with error recovery
 * 
 * Combines position-aware parsing with error recovery to handle incomplete SQL
 * that users are actively typing. Ideal for providing IntelliSense in editors.
 * 
 * @param sql - SQL text to parse
 * @param cursorPosition - Cursor position (character offset or line/column)
 * @param options - Parsing options including error recovery settings
 * @returns Parse result with position-specific information
 */
export function parseToPosition(
    sql: string,
    cursorPosition: number | LineColumn,
    options: ParseToPositionOptions = {}
): PositionParseResult {
    return PositionAwareParser.parseToPosition(sql, cursorPosition, options);
}

/**
 * Analyze cursor context for IntelliSense completion suggestions
 * 
 * Determines what type of completions should be offered at the cursor position
 * based on SQL syntax context (SELECT clause, WHERE condition, etc.).
 * 
 * @param sql - SQL text to analyze
 * @param cursorPosition - Cursor position (character offset or line/column)
 * @returns Cursor context information for completion logic
 */
export function getCursorContext(
    sql: string,
    cursorPosition: number | LineColumn
): IntelliSenseContext {
    if (typeof cursorPosition === 'number') {
        return CursorContextAnalyzer.analyzeIntelliSense(sql, cursorPosition);
    } else {
        return CursorContextAnalyzer.analyzeIntelliSenseAt(sql, cursorPosition);
    }
}

/**
 * Resolve scope information at cursor position
 * 
 * Provides comprehensive information about available tables, CTEs, and columns
 * at the specified cursor position for intelligent completion suggestions.
 * 
 * @param sql - SQL text to analyze
 * @param cursorPosition - Cursor position (character offset or line/column)
 * @returns Complete scope information including available tables and columns
 */
export function resolveScope(
    sql: string,
    cursorPosition: number | LineColumn
): ScopeInfo {
    if (typeof cursorPosition === 'number') {
        return ScopeResolver.resolve(sql, cursorPosition);
    } else {
        return ScopeResolver.resolveAt(sql, cursorPosition);
    }
}

/**
 * Split multi-query SQL text into individual queries
 * 
 * Handles SQL editors that contain multiple statements separated by semicolons.
 * Properly handles string literals and comments containing semicolons.
 * 
 * @param sql - Multi-query SQL text
 * @returns Collection of individual queries with position information
 */
export function splitQueries(sql: string): QueryCollection {
    return MultiQuerySplitter.split(sql);
}

/**
 * Get IntelliSense information for a cursor position in multi-query context
 * 
 * Combines query splitting, context analysis, and scope resolution to provide
 * complete IntelliSense information for a cursor position in multi-query SQL.
 * 
 * @param sql - Multi-query SQL text
 * @param cursorPosition - Cursor position
 * @param options - Parsing options
 * @returns Complete IntelliSense information or undefined if position is invalid
 */
export function getIntelliSenseInfo(
    sql: string,
    cursorPosition: number | LineColumn,
    options: ParseToPositionOptions = {}
): {
    context: IntelliSenseContext;
    scope: ScopeInfo;
    parseResult: PositionParseResult;
    currentQuery: string;
    relativePosition: number;
} | undefined {
    const charPos = typeof cursorPosition === 'number' 
        ? cursorPosition 
        : TextPositionUtils.lineColumnToCharOffset(sql, cursorPosition);
    
    if (charPos === -1) {
        return undefined;
    }
    
    // Split queries and find the active one
    const queries = splitQueries(sql);
    const activeQuery = queries.getActive(charPos);
    
    if (!activeQuery) {
        return undefined;
    }
    
    // Calculate relative position within the active query
    const relativePosition = charPos - activeQuery.start;
    const querySQL = activeQuery.sql;
    
    // Get IntelliSense information for the active query
    const context = getCursorContext(querySQL, relativePosition);
    const scope = resolveScope(querySQL, relativePosition);
    const parseResult = parseToPosition(querySQL, relativePosition, options);
    
    return {
        context,
        scope,
        parseResult,
        currentQuery: querySQL,
        relativePosition
    };
}

/**
 * Get completion suggestions based on cursor context and scope
 * 
 * Uses the new IntelliSense interface to provide targeted completion suggestions.
 * This function leverages the suggestion-based design to efficiently determine
 * what completions should be offered.
 * 
 * @param sql - SQL text
 * @param cursorPosition - Cursor position
 * @returns Array of completion suggestions with context information
 */
export function getCompletionSuggestions(
    sql: string,
    cursorPosition: number | LineColumn
): Array<{
    type: 'keyword' | 'table' | 'column' | 'cte' | 'function';
    value: string;
    detail?: string;
    documentation?: string;
}> {
    const charPos = typeof cursorPosition === 'number' 
        ? cursorPosition 
        : TextPositionUtils.lineColumnToCharOffset(sql, cursorPosition);

    if (charPos === -1) {
        return [];
    }

    const intelliSenseContext = CursorContextAnalyzer.analyzeIntelliSense(sql, charPos);
    const scope = resolveScope(sql, cursorPosition);
    
    const suggestions: Array<{
        type: 'keyword' | 'table' | 'column' | 'cte' | 'function';
        value: string;
        detail?: string;
        documentation?: string;
    }> = [];
    
    // Add keyword suggestions
    if (intelliSenseContext.suggestKeywords) {
        // Add required keywords if specified
        if (intelliSenseContext.requiredKeywords) {
            intelliSenseContext.requiredKeywords.forEach(keyword => {
                suggestions.push({
                    type: 'keyword',
                    value: keyword,
                    detail: `Required keyword: ${keyword}`
                });
            });
        } else {
            // Add general contextual keywords based on token context
            const generalKeywords = getGeneralKeywords(intelliSenseContext);
            generalKeywords.forEach(keyword => {
                suggestions.push({
                    type: 'keyword',
                    value: keyword.value,
                    detail: keyword.detail
                });
            });
        }
    }
    
    // Add table suggestions
    if (intelliSenseContext.suggestTables) {
        scope.availableTables.forEach(table => {
            suggestions.push({
                type: 'table',
                value: table.alias || table.name,
                detail: `Table: ${table.fullName}`,
                documentation: `Available table${table.alias ? ` (alias: ${table.alias})` : ''}`
            });
        });
        
        // Add CTE suggestions
        scope.availableCTEs.forEach(cte => {
            suggestions.push({
                type: 'cte',
                value: cte.name,
                detail: `CTE: ${cte.name}`,
                documentation: `Common Table Expression${cte.columns ? ` with columns: ${cte.columns.join(', ')}` : ''}`
            });
        });
    }
    
    // Add column suggestions
    if (intelliSenseContext.suggestColumns) {
        if (intelliSenseContext.tableScope) {
            // Specific table/alias column completion
            const columns = scope.visibleColumns.filter(col =>
                col.tableName === intelliSenseContext.tableScope ||
                col.tableAlias === intelliSenseContext.tableScope
            );
            
            columns.forEach(col => {
                suggestions.push({
                    type: 'column',
                    value: col.name,
                    detail: `Column: ${col.fullReference}`,
                    documentation: `Column from ${col.tableName}${col.type ? ` (${col.type})` : ''}`
                });
            });
        } else {
            // General column completion
            scope.visibleColumns.forEach(col => {
                suggestions.push({
                    type: 'column',
                    value: col.name === '*' ? '*' : `${col.tableAlias || col.tableName}.${col.name}`,
                    detail: `Column: ${col.fullReference}`,
                    documentation: `Column from ${col.tableName}`
                });
            });
        }
    }
    
    return suggestions;
}

/**
 * Get general keyword suggestions based on IntelliSense context
 */
function getGeneralKeywords(context: IntelliSenseContext): Array<{ value: string; detail: string }> {
    // Determine context from token information
    const prevToken = context.previousToken?.value?.toLowerCase();
    const currentToken = context.currentToken?.value?.toLowerCase();
    
    // SELECT context - aggregate functions and keywords
    if (prevToken === "select" || currentToken === "select") {
        return [
            { value: "DISTINCT", detail: "Remove duplicate rows" },
            { value: "COUNT", detail: "Aggregate function" },
            { value: "SUM", detail: "Aggregate function" },
            { value: "AVG", detail: "Aggregate function" },
            { value: "MAX", detail: "Aggregate function" },
            { value: "MIN", detail: "Aggregate function" }
        ];
    }
    
    // FROM context - JOIN options and clauses
    if (prevToken === "from" || currentToken === "from") {
        return [
            { value: "JOIN", detail: "Inner join tables" },
            { value: "LEFT JOIN", detail: "Left outer join" },
            { value: "RIGHT JOIN", detail: "Right outer join" },
            { value: "FULL JOIN", detail: "Full outer join" },
            { value: "WHERE", detail: "Filter conditions" },
            { value: "GROUP BY", detail: "Group results" },
            { value: "ORDER BY", detail: "Sort results" }
        ];
    }
    
    // WHERE/HAVING context - logical operators
    if (["where", "having", "on"].includes(prevToken || "") || ["where", "having", "on"].includes(currentToken || "")) {
        return [
            { value: "AND", detail: "Logical AND operator" },
            { value: "OR", detail: "Logical OR operator" },
            { value: "NOT", detail: "Logical NOT operator" },
            { value: "IN", detail: "Match any value in list" },
            { value: "LIKE", detail: "Pattern matching" },
            { value: "BETWEEN", detail: "Range comparison" }
        ];
    }
    
    // Default context - general SQL keywords
    return [
        { value: "SELECT", detail: "Query data" },
        { value: "FROM", detail: "Specify table" },
        { value: "WHERE", detail: "Filter conditions" },
        { value: "JOIN", detail: "Join tables" },
        { value: "GROUP BY", detail: "Group results" },
        { value: "ORDER BY", detail: "Sort results" },
        { value: "LIMIT", detail: "Limit results" }
    ];
}

