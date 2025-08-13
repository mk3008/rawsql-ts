import { Lexeme, TokenType } from '../models/Lexeme';
import { LexemeCursor } from './LexemeCursor';

/**
 * Information about a CTE (Common Table Expression) region in SQL text.
 * Provides boundaries and content for SQL editor integration.
 * 
 * @example
 * ```typescript
 * const region: CTERegion = {
 *   name: 'monthly_sales',
 *   startPosition: 5,
 *   endPosition: 150,
 *   sqlContent: 'SELECT id, name FROM users WHERE active = true'
 * };
 * ```
 */
export interface CTERegion {
    /** The name of the CTE (e.g., 'monthly_sales') */
    name: string;
    /** Starting character position in the original SQL text (0-based) */
    startPosition: number;
    /** Ending character position in the original SQL text (0-based) */
    endPosition: number;
    /** The executable SQL content of the CTE (SELECT statement without CTE wrapper) */
    sqlContent: string;
}

/**
 * Result of cursor position analysis for SQL editor integration.
 * Contains information about what SQL should be executed based on cursor position.
 * 
 * @example
 * ```typescript
 * const info: CursorPositionInfo = {
 *   isInCTE: true,
 *   cteRegion: { name: 'users_cte', startPosition: 10, endPosition: 100, sqlContent: '...' },
 *   executableSQL: 'SELECT id, name FROM users WHERE active = true'
 * };
 * ```
 */
export interface CursorPositionInfo {
    /** Whether the cursor is currently positioned inside a CTE region */
    isInCTE: boolean;
    /** The CTE region containing the cursor (null if cursor is not in a CTE) */
    cteRegion: CTERegion | null;
    /** The SQL that should be executed based on cursor position (CTE content or main query) */
    executableSQL: string | null;
}

/**
 * Utility class for detecting CTE (Common Table Expression) regions and extracting executable SQL.
 * 
 * Designed for SQL editor features where users want to execute specific CTE parts based on cursor position.
 * This enables editors to provide "run current section" functionality that intelligently executes
 * either the CTE the cursor is in, or the main query.
 * 
 * @example Basic usage - Analyze cursor position
 * ```typescript
 * const sql = `
 *   WITH users_cte AS (
 *     SELECT id, name FROM users WHERE active = true
 *   )
 *   SELECT * FROM users_cte ORDER BY name
 * `;
 * 
 * const cursorPosition = 50; // Inside the CTE
 * const analysis = CTERegionDetector.analyzeCursorPosition(sql, cursorPosition);
 * 
 * if (analysis.isInCTE) {
 *   console.log(`Execute CTE: ${analysis.cteRegion.name}`);
 *   executeSQL(analysis.executableSQL); // Runs just the CTE SELECT
 * }
 * ```
 * 
 * @example Get all executable sections
 * ```typescript
 * const positions = CTERegionDetector.getCTEPositions(sql);
 * // Returns: [
 * //   { name: 'users_cte', startPosition: 17, type: 'CTE' },
 * //   { name: 'MAIN_QUERY', startPosition: 120, type: 'MAIN_QUERY' }
 * // ]
 * ```
 */
export class CTERegionDetector {
    /**
     * Analyze cursor position and return information about the current context.
     * 
     * This is the main method for SQL editor integration. It determines whether the cursor
     * is inside a CTE or the main query, and provides the appropriate executable SQL.
     * 
     * @param sql - The complete SQL string to analyze
     * @param cursorPosition - The cursor position (0-based character offset)
     * @returns Analysis result containing context information and executable SQL
     * 
     * @example
     * ```typescript
     * const sql = `WITH users AS (SELECT * FROM table) SELECT * FROM users`;
     * const analysis = CTERegionDetector.analyzeCursorPosition(sql, 25);
     * 
     * if (analysis.isInCTE) {
     *   console.log(`Cursor is in CTE: ${analysis.cteRegion.name}`);
     *   executeSQL(analysis.executableSQL); // Execute just the CTE
     * } else {
     *   console.log('Cursor is in main query');
     *   executeSQL(analysis.executableSQL); // Execute the full query
     * }
     * ```
     */
    public static analyzeCursorPosition(sql: string, cursorPosition: number): CursorPositionInfo {
        const cteRegions = this.extractCTERegions(sql);
        
        // Find which CTE region contains the cursor
        const currentCTE = cteRegions.find(region => 
            cursorPosition >= region.startPosition && cursorPosition <= region.endPosition
        );
        
        if (currentCTE) {
            return {
                isInCTE: true,
                cteRegion: currentCTE,
                executableSQL: currentCTE.sqlContent
            };
        } else {
            // Cursor is in main query - return full SQL or main SELECT part
            const mainSQL = this.extractMainQuery(sql, cteRegions);
            return {
                isInCTE: false,
                cteRegion: null,
                executableSQL: mainSQL
            };
        }
    }
    
    /**
     * Extract all CTE regions from SQL text with their boundaries and executable content.
     * 
     * Parses the SQL to identify all Common Table Expressions and their locations,
     * providing the information needed for syntax highlighting, code folding, and selective execution.
     * 
     * @param sql - The SQL string to analyze
     * @returns Array of CTE regions with their boundaries and content
     * 
     * @example
     * ```typescript
     * const sql = `
     *   WITH 
     *     users AS (SELECT * FROM people),
     *     orders AS (SELECT * FROM purchases)
     *   SELECT * FROM users JOIN orders
     * `;
     * 
     * const regions = CTERegionDetector.extractCTERegions(sql);
     * // Returns: [
     * //   { name: 'users', startPosition: 23, endPosition: 45, sqlContent: 'SELECT * FROM people' },
     * //   { name: 'orders', startPosition: 55, endPosition: 80, sqlContent: 'SELECT * FROM purchases' }
     * // ]
     * ```
     */
    public static extractCTERegions(sql: string): CTERegion[] {
        const lexemes = LexemeCursor.getAllLexemesWithPosition(sql);
        const cteRegions: CTERegion[] = [];
        
        let i = 0;
        let inWithClause = false;
        
        while (i < lexemes.length) {
            const lexeme = lexemes[i];
            
            // Detect WITH clause start
            if (lexeme.value.toLowerCase() === 'with' && !inWithClause) {
                inWithClause = true;
                i++;
                continue;
            }
            
            // Skip RECURSIVE keyword if present
            if (inWithClause && lexeme.value.toLowerCase() === 'recursive') {
                i++;
                continue;
            }
            
            // Detect CTE definition (identifier followed by AS)
            if (inWithClause && 
                lexeme.type === TokenType.Identifier && 
                i + 1 < lexemes.length && 
                lexemes[i + 1].value.toLowerCase() === 'as') {
                
                const cteName = lexeme.value;
                const cteStartPos = lexeme.position!.startPosition;
                
                // Find the opening parenthesis after AS
                let parenIndex = i + 2;
                while (parenIndex < lexemes.length && lexemes[parenIndex].value !== '(') {
                    parenIndex++;
                }
                
                if (parenIndex < lexemes.length) {
                    // Find matching closing parenthesis
                    const cteEndInfo = this.findMatchingParen(lexemes, parenIndex);
                    if (cteEndInfo) {
                        const cteEndPos = cteEndInfo.endPosition;
                        const sqlContent = this.extractCTESQL(sql, lexemes, parenIndex, cteEndInfo.index);
                        
                        cteRegions.push({
                            name: cteName,
                            startPosition: cteStartPos,
                            endPosition: cteEndPos,
                            sqlContent: sqlContent
                        });
                        
                        i = cteEndInfo.index + 1;
                        continue;
                    }
                }
            }
            
            // Check if we've reached the main SELECT (end of WITH clause)
            if (inWithClause && lexeme.value.toLowerCase() === 'select') {
                // Verify this is not a SELECT inside a CTE by checking context
                if (this.isMainQuerySelect(lexemes, i)) {
                    break;
                }
            }
            
            i++;
        }
        
        return cteRegions;
    }
    
    /**
     * Find matching closing parenthesis for CTE definition
     */
    private static findMatchingParen(lexemes: Lexeme[], openParenIndex: number): { index: number, endPosition: number } | null {
        let depth = 1;
        let i = openParenIndex + 1;
        
        while (i < lexemes.length && depth > 0) {
            if (lexemes[i].value === '(') {
                depth++;
            } else if (lexemes[i].value === ')') {
                depth--;
            }
            
            if (depth === 0) {
                return {
                    index: i,
                    endPosition: lexemes[i].position!.endPosition
                };
            }
            i++;
        }
        
        return null;
    }
    
    /**
     * Extract the SQL content of a CTE (the SELECT statement inside parentheses)
     */
    private static extractCTESQL(sql: string, lexemes: Lexeme[], openParenIndex: number, closeParenIndex: number): string {
        const startPos = lexemes[openParenIndex + 1].position!.startPosition;
        const endPos = lexemes[closeParenIndex - 1].position!.endPosition;
        
        return sql.substring(startPos, endPos).trim();
    }
    
    /**
     * Check if a SELECT lexeme is the main query SELECT (not inside a CTE)
     */
    private static isMainQuerySelect(lexemes: Lexeme[], selectIndex: number): boolean {
        // Look backwards to see if we're still in a parenthesized context
        let depth = 0;
        for (let i = selectIndex - 1; i >= 0; i--) {
            if (lexemes[i].value === ')') {
                depth++;
            } else if (lexemes[i].value === '(') {
                depth--;
            }
        }
        
        return depth === 0; // We're at top level if depth is 0
    }
    
    /**
     * Extract the main query part (non-CTE SQL)
     */
    private static extractMainQuery(sql: string, cteRegions: CTERegion[]): string {
        if (cteRegions.length === 0) {
            return sql.trim();
        }
        
        // Find the end of the last CTE
        const lastCTE = cteRegions[cteRegions.length - 1];
        const mainQueryStart = lastCTE.endPosition;
        
        // Find the main SELECT
        let selectPos = mainQueryStart;
        while (selectPos < sql.length) {
            const remaining = sql.substring(selectPos).toLowerCase().trim();
            if (remaining.startsWith('select')) {
                break;
            }
            selectPos++;
        }
        
        return sql.substring(selectPos).trim();
    }
    
    /**
     * Get a list of all executable sections (CTEs and main query) with their start positions.
     * 
     * This method is particularly useful for building editor UI features such as:
     * - Dropdown menus for section selection
     * - Sidebar navigation for large queries
     * - Quick jump functionality
     * - "Run section" buttons
     * 
     * @param sql - The SQL string to analyze
     * @returns Array of executable sections with their names, positions, and types
     * 
     * @example
     * ```typescript
     * const sql = `
     *   WITH monthly_sales AS (SELECT ...), 
     *        yearly_summary AS (SELECT ...)
     *   SELECT * FROM yearly_summary
     * `;
     * 
     * const positions = CTERegionDetector.getCTEPositions(sql);
     * // Returns: [
     * //   { name: 'monthly_sales', startPosition: 17, type: 'CTE' },
     * //   { name: 'yearly_summary', startPosition: 55, type: 'CTE' },
     * //   { name: 'MAIN_QUERY', startPosition: 120, type: 'MAIN_QUERY' }
     * // ]
     * 
     * // Use for editor UI
     * positions.forEach(section => {
     *   addMenuItem(`${section.type}: ${section.name}`, () => {
     *     jumpToPosition(section.startPosition);
     *   });
     * });
     * ```
     */
    public static getCTEPositions(sql: string): Array<{ name: string, startPosition: number, type: 'CTE' | 'MAIN_QUERY' }> {
        const cteRegions = this.extractCTERegions(sql);
        const results: Array<{ name: string, startPosition: number, type: 'CTE' | 'MAIN_QUERY' }> = [];
        
        // Add CTE regions
        cteRegions.forEach(region => {
            results.push({
                name: region.name,
                startPosition: region.startPosition,
                type: 'CTE'
            });
        });
        
        // Add main query position
        if (cteRegions.length > 0) {
            const lastCTE = cteRegions[cteRegions.length - 1];
            let mainQueryPos = lastCTE.endPosition;
            
            // Find the SELECT keyword
            while (mainQueryPos < sql.length) {
                const remaining = sql.substring(mainQueryPos).toLowerCase().trim();
                if (remaining.startsWith('select')) {
                    results.push({
                        name: 'MAIN_QUERY',
                        startPosition: mainQueryPos,
                        type: 'MAIN_QUERY'
                    });
                    break;
                }
                mainQueryPos++;
            }
        } else {
            // No CTEs, entire SQL is main query
            results.push({
                name: 'MAIN_QUERY',
                startPosition: 0,
                type: 'MAIN_QUERY'
            });
        }
        
        return results;
    }
}