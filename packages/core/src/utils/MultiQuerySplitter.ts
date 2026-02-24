import { LineColumn } from './LexemeCursor';
import { TextPositionUtils } from './TextPositionUtils';

/**
 * Information about a single query within multi-query text
 */
export interface QueryInfo {
    /** SQL text of this query */
    sql: string;
    /** Start position in the original text (0-based character offset) */
    start: number;
    /** End position in the original text (0-based character offset) */
    end: number;
    /** Line number where query starts (1-based) */
    startLine: number;
    /** Line number where query ends (1-based) */
    endLine: number;
    /** Query index in the original text (0-based) */
    index: number;
    /** Whether this query is empty or contains only whitespace/comments */
    isEmpty: boolean;
}

/**
 * Collection of queries from multi-query text
 */
export interface QueryCollection {
    /** All queries found in the text */
    queries: QueryInfo[];
    /** Original text that was split */
    originalText: string;
    
    /**
     * Get the query that contains the specified cursor position
     * @param cursorPosition - Cursor position (character offset or line/column)
     */
    getActive(cursorPosition: number | LineColumn): QueryInfo | undefined;
    
    /**
     * Get the query at the specified index
     * @param index - Query index (0-based)
     */
    getQuery(index: number): QueryInfo | undefined;
    
    /**
     * Get all non-empty queries
     */
    getNonEmpty(): QueryInfo[];
}

/**
 * Splits SQL text containing multiple queries separated by semicolons
 * 
 * Provides sophisticated query boundary detection that properly handles:
 * - String literals containing semicolons
 * - Comments containing semicolons  
 * - Nested structures and complex SQL
 * - Empty queries and whitespace handling
 * 
 * @example
 * ```typescript
 * const multiSQL = `
 *   -- First query
 *   SELECT 'hello;world' FROM users;
 *   
 *   // Second query with comment
 *   SELECT id FROM orders WHERE status = 'active';
 *   
 *   -- Empty query
 *   ;
 * `;
 * 
 * const queries = MultiQuerySplitter.split(multiSQL);
 * console.log(queries.queries.length); // 3 queries
 * 
 * // Find query at cursor position
 * const active = queries.getActive(150);
 * console.log(active?.sql); // Query containing position 150
 * ```
 */
export class MultiQuerySplitter {
    /**
     * Split multi-query SQL text into individual queries
     * 
     * @param text - SQL text that may contain multiple queries separated by semicolons
     * @returns Collection of individual queries with position information
     */
    public static split(text: string): QueryCollection {
        const queries: QueryInfo[] = [];
        
        // Handle completely empty or whitespace-only text
        if (!text || text.trim() === '') {
            return {
                queries: [],
                originalText: text,
                getActive: () => undefined,
                getQuery: () => undefined,
                getNonEmpty: () => []
            };
        }
        
        const rawBoundaries = this.splitRespectingQuotesAndComments(text);
        const boundaries = this.mergeTrailingCommentSegments(rawBoundaries, text);
        
        
        let queryIndex = 0;
        for (const boundary of boundaries) {
            const rawSql = boundary.text.trim();
            const isEmpty = this.isEmptyQuery(rawSql);
            
            // Use raw SQL as-is - boundaries are already correctly split by valid semicolons
            const sql = rawSql;
            
            
            const startLineCol = TextPositionUtils.charOffsetToLineColumn(text, boundary.start);
            const endLineCol = TextPositionUtils.charOffsetToLineColumn(text, boundary.end);
            
            queries.push({
                sql,
                start: boundary.start,
                end: boundary.end,
                startLine: startLineCol?.line || 1,
                endLine: endLineCol?.line || 1,
                index: queryIndex++,
                isEmpty
            });
        }
        
        return {
            queries,
            originalText: text,
            getActive: (cursorPosition: number | LineColumn) => {
                const charPos = typeof cursorPosition === 'number' 
                    ? cursorPosition 
                    : TextPositionUtils.lineColumnToCharOffset(text, cursorPosition);
                    
                if (charPos === -1) return undefined;
                
                return queries.find(query => 
                    charPos >= query.start && charPos <= query.end
                );
            },
            getQuery: (index: number) => {
                return queries[index];
            },
            getNonEmpty: () => {
                return queries.filter(q => !q.isEmpty);
            }
        };
    }
    
    /**
     * Split text by semicolons while respecting quotes and comments.
     * Single-pass O(n) implementation with support for:
     * - Single-quoted strings ('...' with '' escaping)
     * - Double-quoted identifiers ("..." with "" escaping)
     * - Line comments (--)
     * - Block comments (/* ... *\/)
     * - PostgreSQL dollar-quoted strings ($$...$$ or $tag$...$tag$)
     */
    private static splitRespectingQuotesAndComments(text: string): Array<{ text: string; start: number; end: number }> {
        const segments: Array<{ text: string; start: number; end: number }> = [];
        let currentStart = 0;
        let i = 0;

        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inLineComment = false;
        let inBlockComment = false;
        let inDollarQuote = false;
        let dollarTag = '';

        while (i < text.length) {
            const char = text[i];

            // --- inside line comment ---
            if (inLineComment) {
                if (char === '\n') inLineComment = false;
                i++;
                continue;
            }

            // --- inside block comment ---
            if (inBlockComment) {
                if (char === '*' && text[i + 1] === '/') {
                    inBlockComment = false;
                    i += 2;
                } else {
                    i++;
                }
                continue;
            }

            // --- inside dollar-quoted string ---
            if (inDollarQuote) {
                const closing = '$' + dollarTag + '$';
                if (text.startsWith(closing, i)) {
                    inDollarQuote = false;
                    dollarTag = '';
                    i += closing.length;
                } else {
                    i++;
                }
                continue;
            }

            // --- inside single-quoted string ---
            if (inSingleQuote) {
                if (char === "'" && text[i + 1] === "'") {
                    i += 2; // escaped quote
                } else if (char === "'") {
                    inSingleQuote = false;
                    i++;
                } else {
                    i++;
                }
                continue;
            }

            // --- inside double-quoted identifier ---
            if (inDoubleQuote) {
                if (char === '"' && text[i + 1] === '"') {
                    i += 2; // escaped quote
                } else if (char === '"') {
                    inDoubleQuote = false;
                    i++;
                } else {
                    i++;
                }
                continue;
            }

            // --- unquoted context ---

            // line comment
            if (char === '-' && text[i + 1] === '-') {
                inLineComment = true;
                i += 2;
                continue;
            }

            // block comment
            if (char === '/' && text[i + 1] === '*') {
                inBlockComment = true;
                i += 2;
                continue;
            }

            // dollar-quoted string: $tag$ where tag is empty or [a-zA-Z_]\w*
            if (char === '$') {
                const tagEnd = text.indexOf('$', i + 1);
                if (tagEnd !== -1) {
                    const tag = text.substring(i + 1, tagEnd);
                    if (/^([a-zA-Z_]\w*)?$/.test(tag)) {
                        inDollarQuote = true;
                        dollarTag = tag;
                        i = tagEnd + 1;
                        continue;
                    }
                }
            }

            // single quote
            if (char === "'") {
                inSingleQuote = true;
                i++;
                continue;
            }

            // double quote
            if (char === '"') {
                inDoubleQuote = true;
                i++;
                continue;
            }

            // valid semicolon split point
            if (char === ';') {
                segments.push({ text: text.substring(currentStart, i), start: currentStart, end: i });
                currentStart = i + 1;
                i++;
                continue;
            }

            i++;
        }

        // remaining text after last semicolon (or entire text if no semicolon)
        const remaining = text.substring(currentStart);
        if (remaining.length > 0 || segments.length === 0) {
            segments.push({ text: remaining, start: currentStart, end: text.length });
        }

        return segments;
    }

    
    /**
     * Merge comment-only segments with previous executable segments
     */
    private static mergeTrailingCommentSegments(
        segments: Array<{ text: string; start: number; end: number }>,
        fullText: string
    ): Array<{ text: string; start: number; end: number }> {
        const merged: Array<{ text: string; start: number; end: number }> = [];
        
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const segmentText = segment.text.trim();
            
            // Check if this segment contains only comments/whitespace (no executable SQL)
            const isCommentOnly = this.isEmptyQuery(segmentText);
            
            
            if (isCommentOnly && merged.length > 0) {
                // Only merge if this appears to be a trailing line comment (starts with --)
                // and the previous segment contains executable SQL
                const lastSegmentText = merged[merged.length - 1].text.trim();
                const isTrailingLineComment = segmentText.startsWith('--');
                const previousHasSQL = !this.isEmptyQuery(lastSegmentText);
                
                if (isTrailingLineComment && previousHasSQL) {
                    // Merge trailing line comment with previous SQL segment
                    const lastSegment = merged[merged.length - 1];
                    merged[merged.length - 1] = {
                        text: fullText.substring(lastSegment.start, segment.end),
                        start: lastSegment.start,
                        end: segment.end
                    };
                } else {
                    // Keep as separate segment (empty query or standalone comment)
                    merged.push(segment);
                }
            } else {
                // Add as new segment
                merged.push(segment);
            }
        }
        
        return merged;
    }

    /**
     * Clean SQL comments and extract SQL statements
     * 
     * @param sql - SQL query text
     * @returns Cleaned SQL text or null if no SQL remains
     */
    private static cleanSqlComments(sql: string): string | null {
        if (!sql) return null;
        
        // Remove comments and extract SQL
        let cleaned = sql;
        
        // Remove line comments - standard SQL behavior: -- comments out to end of line
        cleaned = cleaned.split('\n').map(line => {
            const commentStart = line.indexOf('--');
            if (commentStart >= 0) {
                return line.substring(0, commentStart);
            }
            return line;
        }).join('\n');
        
        // Remove block comments
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
        
        const result = cleaned.trim();
        return result.length > 0 ? result : null;
    }

    private static isEmptyQuery(sql: string): boolean {
        if (!sql) return true;
        return this.cleanSqlComments(sql) === null;
    }
    
}

/**
 * Utility functions for working with query collections
 */
export class MultiQueryUtils {
    /**
     * Get context information for IntelliSense at a cursor position
     * 
     * @param text - Multi-query SQL text
     * @param cursorPosition - Cursor position
     * @returns Active query and position within that query
     */
    public static getContextAt(
        text: string, 
        cursorPosition: number | LineColumn
    ): { query: QueryInfo; relativePosition: number } | undefined {
        const queries = MultiQuerySplitter.split(text);
        const activeQuery = queries.getActive(cursorPosition);
        
        if (!activeQuery) return undefined;
        
        const charPos = typeof cursorPosition === 'number' 
            ? cursorPosition 
            : TextPositionUtils.lineColumnToCharOffset(text, cursorPosition);
            
        if (charPos === -1) return undefined;
        
        const relativePosition = charPos - activeQuery.start;
        
        return { query: activeQuery, relativePosition };
    }
    
    /**
     * Extract all non-empty queries from multi-query text
     * 
     * @param text - Multi-query SQL text
     * @returns Array of query SQL strings
     */
    public static extractQueries(text: string): string[] {
        const queries = MultiQuerySplitter.split(text);
        return queries.getNonEmpty().map(q => q.sql);
    }
    
}