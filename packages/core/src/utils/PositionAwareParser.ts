import { SelectQuery, SimpleSelectQuery } from '../models/SelectQuery';
import { SelectQueryParser, ParseAnalysisResult } from '../parsers/SelectQueryParser';
import { SqlTokenizer } from '../parsers/SqlTokenizer';
import { Lexeme } from '../models/Lexeme';
import { LineColumn, LexemeCursor } from './LexemeCursor';
import { TextPositionUtils } from './TextPositionUtils';

/**
 * Options for position-aware parsing
 */
export interface ParseToPositionOptions {
    /** Enable error recovery to continue parsing after syntax errors */
    errorRecovery?: boolean;
    /** Insert missing tokens (e.g., missing FROM keywords) */
    insertMissingTokens?: boolean;
    /** Parse only up to the specified position */
    parseToPosition?: { line: number; column: number } | number;
    /** Maximum number of error recovery attempts */
    maxRecoveryAttempts?: number;
}

/**
 * Result of position-aware parsing
 */
export interface PositionParseResult extends ParseAnalysisResult {
    /** Tokens that were parsed up to the cursor position */
    parsedTokens?: Lexeme[];
    /** Token immediately before the cursor position */
    tokenBeforeCursor?: Lexeme;
    /** Whether parsing stopped at the cursor position */
    stoppedAtCursor?: boolean;
    /** Number of error recovery attempts made */
    recoveryAttempts?: number;
    /** Partial AST even if parsing failed */
    partialAST?: SelectQuery;
}

/**
 * Position-aware SQL parser with error recovery for IntelliSense
 * 
 * Extends the standard parser to handle incomplete SQL and provide context
 * for IntelliSense scenarios where users are actively typing.
 * 
 * @example
 * ```typescript
 * // Parse incomplete SQL with error recovery
 * const sql = "SELECT user.name FROM users user WHERE user.";
 * const result = PositionAwareParser.parseToPosition(sql, sql.length, {
 *   errorRecovery: true,
 *   insertMissingTokens: true
 * });
 * 
 * console.log(result.tokenBeforeCursor?.value); // "."
 * console.log(result.success); // true (with recovery)
 * ```
 */
export class PositionAwareParser {
    /**
     * Parse SQL text up to a specific position with error recovery
     * 
     * @param sql - SQL text to parse
     * @param cursorPosition - Character position to parse up to (0-based) or line/column
     * @param options - Parsing options including error recovery
     * @returns Parse result with position-specific information
     */
    public static parseToPosition(
        sql: string, 
        cursorPosition: number | LineColumn,
        options: ParseToPositionOptions = {}
    ): PositionParseResult {
        const charPosition = typeof cursorPosition === 'number' 
            ? cursorPosition 
            : TextPositionUtils.lineColumnToCharOffset(sql, cursorPosition);
            
        if (charPosition === -1) {
            return {
                success: false,
                error: 'Invalid cursor position',
                stoppedAtCursor: false
            };
        }
        
        try {
            // First, try normal parsing
            const normalResult = this.tryNormalParse(sql, charPosition, options);
            if (normalResult.success) {
                return normalResult;
            }
            
            // If normal parsing fails and error recovery is enabled, try recovery
            if (options.errorRecovery) {
                return this.tryErrorRecovery(sql, charPosition, options);
            }
            
            return normalResult;
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                stoppedAtCursor: false
            };
        }
    }
    
    /**
     * Parse current query from multi-query text at cursor position
     * 
     * @param sql - Complete SQL text (may contain multiple statements)
     * @param cursorPosition - Cursor position
     * @param options - Parsing options
     * @returns Parse result for the current query only
     */
    public static parseCurrentQuery(
        sql: string,
        cursorPosition: number | LineColumn,
        options: ParseToPositionOptions = {}
    ): PositionParseResult {
        const charPosition = typeof cursorPosition === 'number' 
            ? cursorPosition 
            : TextPositionUtils.lineColumnToCharOffset(sql, cursorPosition);
            
        if (charPosition === -1) {
            return {
                success: false,
                error: 'Invalid cursor position',
                stoppedAtCursor: false
            };
        }
        
        // Split SQL by semicolons and find the query containing the cursor
        const queryBoundaries = this.findQueryBoundaries(sql);
        const currentQuery = this.findQueryAtPosition(queryBoundaries, charPosition);
        
        if (!currentQuery) {
            return {
                success: false,
                error: 'No query found at cursor position',
                stoppedAtCursor: false
            };
        }
        
        // Parse just the current query
        const relativePosition = charPosition - currentQuery.start;
        const querySQL = sql.substring(currentQuery.start, currentQuery.end);
        
        return this.parseToPosition(querySQL, relativePosition, options);
    }
    
    private static tryNormalParse(
        sql: string, 
        cursorPosition: number, 
        options: ParseToPositionOptions
    ): PositionParseResult {
        // Check for invalid cursor position first
        if (cursorPosition < 0 || cursorPosition > sql.length) {
            return {
                success: false,
                error: 'Invalid cursor position',
                stoppedAtCursor: false
            };
        }
        
        // Check if SQL appears incomplete (ends with dot, comma, etc.)
        const trimmedSql = sql.trim();
        const incompletePatterns = ['.', ',', 'SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'GROUP BY', 'ORDER BY'];
        const appearsIncomplete = incompletePatterns.some(pattern => 
            trimmedSql.toLowerCase().endsWith(pattern.toLowerCase())
        );
        
        // Try to parse the complete SQL
        const analysisResult = SelectQueryParser.analyze(sql);
        
        // If parsing failed OR SQL appears incomplete, return failure to trigger error recovery
        if (!analysisResult.success || appearsIncomplete) {
            return { ...analysisResult, success: false };
        }
        
        // Get tokens and find cursor token
        const allTokens = this.getAllTokens(sql);
        const cursorToken = this.findTokenAtPosition(allTokens, cursorPosition);
        const beforeCursor = this.findTokenBeforePosition(allTokens, cursorPosition);
        
        return {
            ...analysisResult,
            parsedTokens: allTokens,
            tokenBeforeCursor: beforeCursor,
            stoppedAtCursor: cursorPosition < sql.length, // True if cursor is before end of SQL
            recoveryAttempts: 0 // Normal parse, no recovery needed
        };
    }
    
    private static tryErrorRecovery(
        sql: string, 
        cursorPosition: number, 
        options: ParseToPositionOptions
    ): PositionParseResult {
        const maxAttempts = options.maxRecoveryAttempts || 5;
        let attempts = 0;
        
        // Error recovery strategies in order of preference
        const strategies = [
            () => this.recoverWithTokenInsertion(sql, cursorPosition, options),
            () => this.recoverWithTruncation(sql, cursorPosition, options),
            () => this.recoverWithCompletion(sql, cursorPosition, options),
            () => this.recoverWithMinimalSQL(sql, cursorPosition, options)
        ];
        
        for (const strategy of strategies) {
            if (attempts >= maxAttempts) break;
            attempts++;
            
            try {
                const result = strategy();
                if (result.success) {
                    result.recoveryAttempts = attempts;
                    return result;
                }
            } catch (error) {
                continue; // Try next strategy
            }
        }
        
        // All recovery attempts failed
        return {
            success: false,
            error: 'All error recovery attempts failed',
            recoveryAttempts: attempts,
            stoppedAtCursor: false
        };
    }
    
    private static recoverWithTokenInsertion(
        sql: string, 
        cursorPosition: number, 
        options: ParseToPositionOptions
    ): PositionParseResult {
        if (!options.insertMissingTokens) {
            throw new Error('Token insertion disabled');
        }
        
        // Common patterns to fix
        const fixes = [
            { pattern: /SELECT\s*$/i, replacement: 'SELECT 1 ' },
            { pattern: /FROM\s*$/i, replacement: 'FROM dual ' },
            { pattern: /WHERE\s*$/i, replacement: 'WHERE 1=1 ' },
            { pattern: /JOIN\s*$/i, replacement: 'JOIN dual ON 1=1 ' },
            { pattern: /ON\s*$/i, replacement: 'ON 1=1 ' },
            { pattern: /GROUP\s+BY\s*$/i, replacement: 'GROUP BY 1 ' },
            { pattern: /ORDER\s+BY\s*$/i, replacement: 'ORDER BY 1 ' }
        ];
        
        let fixedSQL = sql;
        for (const fix of fixes) {
            if (fix.pattern.test(sql)) {
                fixedSQL = sql.replace(fix.pattern, fix.replacement);
                break;
            }
        }
        
        if (fixedSQL === sql) {
            throw new Error('No applicable token insertion found');
        }
        
        const result = SelectQueryParser.analyze(fixedSQL);
        const tokens = this.getAllTokens(sql); // Use original SQL for tokens
        
        return {
            ...result,
            parsedTokens: tokens,
            tokenBeforeCursor: this.findTokenBeforePosition(tokens, cursorPosition),
            stoppedAtCursor: true,
            recoveryAttempts: 1
        };
    }
    
    private static recoverWithTruncation(
        sql: string, 
        cursorPosition: number, 
        options: ParseToPositionOptions
    ): PositionParseResult {
        // Try truncating at cursor position and adding minimal completion
        const truncated = sql.substring(0, cursorPosition);
        const completions = [
            '', // Try as-is first
            ' 1', // Add simple expression
            ' FROM dual', // Add FROM clause
            ' WHERE 1=1' // Add WHERE clause
        ];
        
        for (const completion of completions) {
            try {
                const testSQL = truncated + completion;
                const result = SelectQueryParser.analyze(testSQL);
                
                if (result.success) {
                    const tokens = this.getAllTokens(sql);
                    return {
                        ...result,
                        parsedTokens: tokens.filter(t => 
                            t.position && t.position.startPosition <= cursorPosition
                        ),
                        tokenBeforeCursor: this.findTokenBeforePosition(tokens, cursorPosition),
                        stoppedAtCursor: true,
                        recoveryAttempts: 1
                    };
                }
            } catch (error) {
                continue;
            }
        }
        
        throw new Error('Truncation recovery failed');
    }
    
    private static recoverWithCompletion(
        sql: string, 
        cursorPosition: number, 
        options: ParseToPositionOptions
    ): PositionParseResult {
        // Try completing common incomplete patterns
        const beforeCursor = sql.substring(0, cursorPosition);
        const afterCursor = sql.substring(cursorPosition);
        
        const completions = [
            { pattern: /\.\s*$/, completion: 'id' }, // Complete column reference
            { pattern: /\w+\s*$/, completion: '' }, // Complete identifier
            { pattern: /,\s*$/, completion: '1' }, // Complete list item
            { pattern: /\(\s*$/, completion: '1)' } // Complete parentheses
        ];
        
        for (const comp of completions) {
            if (comp.pattern.test(beforeCursor)) {
                const testSQL = beforeCursor + comp.completion + afterCursor;
                try {
                    const result = SelectQueryParser.analyze(testSQL);
                    if (result.success) {
                        const tokens = this.getAllTokens(sql);
                        return {
                            ...result,
                            parsedTokens: tokens,
                            tokenBeforeCursor: this.findTokenBeforePosition(tokens, cursorPosition),
                            stoppedAtCursor: true,
                            recoveryAttempts: 1
                        };
                    }
                } catch (error) {
                    continue;
                }
            }
        }
        
        throw new Error('Completion recovery failed');
    }
    
    private static recoverWithMinimalSQL(
        sql: string, 
        cursorPosition: number, 
        options: ParseToPositionOptions
    ): PositionParseResult {
        // Generate minimal valid SQL that preserves structure up to cursor
        const minimalSQL = 'SELECT 1 FROM dual WHERE 1=1';
        
        try {
            const result = SelectQueryParser.analyze(minimalSQL);
            const tokens = this.getAllTokens(sql);
            
            return {
                success: true,
                query: result.query,
                parsedTokens: tokens.filter(t => 
                    t.position && t.position.startPosition <= cursorPosition
                ),
                tokenBeforeCursor: this.findTokenBeforePosition(tokens, cursorPosition),
                stoppedAtCursor: true,
                partialAST: result.query,
                recoveryAttempts: 1
            };
        } catch (error) {
            throw new Error('Minimal SQL recovery failed');
        }
    }
    
    private static getAllTokens(sql: string): Lexeme[] {
        try {
            // Use LexemeCursor which includes position information
            return LexemeCursor.getAllLexemesWithPosition(sql);
        } catch (error) {
            return [];
        }
    }
    
    private static findTokenAtPosition(tokens: Lexeme[], position: number): Lexeme | undefined {
        return tokens.find(token => 
            token.position &&
            position >= token.position.startPosition &&
            position < token.position.endPosition
        );
    }
    
    private static findTokenBeforePosition(tokens: Lexeme[], position: number): Lexeme | undefined {
        // Find the last token that ends at or before the position
        let beforeToken: Lexeme | undefined;
        
        for (const token of tokens) {
            if (token.position) {
                if (token.position.endPosition <= position) {
                    beforeToken = token;
                } else if (token.position.startPosition < position) {
                    // Current position is within this token, so previous token is the one before
                    break;
                } else {
                    // We've passed the cursor position
                    break;
                }
            }
        }
        
        return beforeToken;
    }
    
    private static findQueryBoundaries(sql: string): Array<{ start: number; end: number }> {
        const boundaries: Array<{ start: number; end: number }> = [];
        let currentStart = 0;
        let inString = false;
        let stringChar = '';
        let inComment = false;
        
        for (let i = 0; i < sql.length; i++) {
            const char = sql[i];
            const nextChar = i < sql.length - 1 ? sql[i + 1] : '';
            
            // Handle string literals
            if (!inComment && (char === "'" || char === '"')) {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                    stringChar = '';
                }
                continue;
            }
            
            // Handle comments
            if (!inString && char === '-' && nextChar === '-') {
                inComment = true;
                i++; // Skip next char
                continue;
            }
            
            if (inComment && char === '\n') {
                inComment = false;
                continue;
            }
            
            // Handle semicolons (query boundaries)
            if (!inString && !inComment && char === ';') {
                boundaries.push({ start: currentStart, end: i });
                currentStart = i + 1;
            }
        }
        
        // Add final query if no trailing semicolon
        if (currentStart < sql.length) {
            boundaries.push({ start: currentStart, end: sql.length });
        }
        
        return boundaries;
    }
    
    private static findQueryAtPosition(
        boundaries: Array<{ start: number; end: number }>, 
        position: number
    ): { start: number; end: number } | undefined {
        return boundaries.find(boundary => 
            position >= boundary.start && position <= boundary.end
        );
    }
    
}