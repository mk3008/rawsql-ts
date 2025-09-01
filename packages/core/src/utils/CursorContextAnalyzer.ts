import { Lexeme } from '../models/Lexeme';
import { LexemeCursor, LineColumn } from './LexemeCursor';
import { TextPositionUtils } from './TextPositionUtils';
import { KeywordCache } from './KeywordCache';


/**
 * IntelliSense context focused on what suggestions can be provided
 */
export interface IntelliSenseContext {
    /** Whether to suggest table names (can provide actual table list) */
    suggestTables: boolean;
    
    /** Whether to suggest column names (can provide actual column list) */
    suggestColumns: boolean;
    
    /** Whether to suggest SQL keywords (can provide keyword list) */
    suggestKeywords: boolean;
    
    /** If suggesting columns, limit to this table's columns (for table.| syntax) */
    tableScope?: string;
    
    /** If suggesting keywords, these specific keywords are required */
    requiredKeywords?: string[];
    
    
    
    /** Token at cursor position (if any) */
    currentToken?: Lexeme;
    
    /** Token immediately before cursor position */
    previousToken?: Lexeme;
}

/**
 * Position-aware SQL context analyzer for IntelliSense
 * 
 * Provides AST-based context detection by analyzing cursor position
 * within SQL text to determine what suggestions should be provided.
 * 
 * @example
 * ```typescript
 * const context = CursorContextAnalyzer.analyzeIntelliSense('SELECT * FROM users WHERE u.|', 35);
 * console.log(context.suggestColumns); // true
 * console.log(context.tableScope); // "u"
 * ```
 */
/**
 * Processed keyword patterns cache for IntelliSense
 */
interface KeywordPatternCache {
    /** Single keywords that require specific follow-up keywords */
    requiresKeywords: Map<string, string[]>;
    /** Keywords that suggest tables after them */
    suggestsTables: Set<string>;
    /** Keywords that suggest columns after them */
    suggestsColumns: Set<string>;
}

export class CursorContextAnalyzer {
    /**
     * Cache for processed keyword patterns
     */
    private static patternCache: KeywordPatternCache | null = null;
    
    /**
     * Process existing dictionaries into IntelliSense-friendly patterns
     * Single source of truth: existing CommandTokenReader dictionaries
     */
    private static getKeywordPatterns(): KeywordPatternCache {
        if (this.patternCache !== null) {
            return this.patternCache;
        }
        
        const requiresKeywords = new Map<string, string[]>();
        const suggestsTables = new Set<string>();
        const suggestsColumns = new Set<string>();
        
        // Extract all patterns by systematically testing the dictionaries
        this.extractKeywordPatterns(requiresKeywords, suggestsTables, suggestsColumns);
        
        // Cache the processed patterns
        this.patternCache = {
            requiresKeywords,
            suggestsTables,
            suggestsColumns
        };
        
        return this.patternCache;
    }
    
    /**
     * Extract all keyword patterns from the existing dictionaries
     */
    private static extractKeywordPatterns(
        requiresKeywords: Map<string, string[]>,
        suggestsTables: Set<string>,
        suggestsColumns: Set<string>
    ): void {
        // Define SQL contexts and their expected behavior
        const tableContexts = ['from', 'join'];  // Keywords that introduce table names
        const columnContexts = ['select', 'where', 'on', 'having', 'by'];  // Keywords that introduce columns
        
        // Check table context keywords
        for (const keyword of tableContexts) {
            if (this.isKeywordInDictionary(keyword)) {
                suggestsTables.add(keyword);
            }
        }
        
        // Check column context keywords  
        for (const keyword of columnContexts) {
            if (this.isKeywordInDictionary(keyword)) {
                suggestsColumns.add(keyword);
            }
        }
        
        // Extract all keyword patterns that require followups
        this.extractRequiresKeywordPatterns(requiresKeywords);
    }
    
    /**
     * Check if a keyword exists in the command dictionaries using existing parsers
     */
    private static isKeywordInDictionary(keyword: string): boolean {
        // Use KeywordCache for JOIN keywords
        if (KeywordCache.isValidJoinKeyword(keyword)) {
            return true;
        }
        
        // Check if keyword exists in command dictionary
        // Since we can't directly query the trie, use known keyword list
        const knownKeywords = ['from', 'join', 'select', 'where', 'on', 'having', 'by', 'group', 'order'];
        return knownKeywords.includes(keyword);
    }
    
    /**
     * Extract all keywords that require specific followup keywords
     */
    private static extractRequiresKeywordPatterns(requiresKeywords: Map<string, string[]>): void {
        // Test all potential first words that might require followup keywords
        const potentialFirstWords = [
            // JOIN modifiers
            'inner', 'left', 'right', 'full', 'cross', 'natural', 'outer',
            // Other composite keywords
            'group', 'order'
        ];
        
        for (const word of potentialFirstWords) {
            const possibleFollowups = this.findPossibleFollowups(word);
            
            if (possibleFollowups.length > 0) {
                requiresKeywords.set(word, possibleFollowups);
            }
        }
    }
    
    /**
     * Find all possible followup keywords for a given word using KeywordCache
     */
    private static findPossibleFollowups(word: string): string[] {
        const followups = new Set<string>();
        
        // Use KeywordCache for JOIN-related suggestions
        const joinSuggestions = KeywordCache.getJoinSuggestions(word.toLowerCase());
        joinSuggestions.forEach(s => followups.add(s.toUpperCase()));
        
        // Use KeywordCache for command-related suggestions
        const commandSuggestions = KeywordCache.getCommandSuggestions(word.toLowerCase());
        commandSuggestions.forEach(s => followups.add(s.toUpperCase()));
        
        return Array.from(followups);
    }
    
    
    
    
    
    /**
     * Helper function to check if a token requires specific keywords
     */
    private static requiresSpecificKeywords(tokenValue: string): { suggestKeywords: true; requiredKeywords: string[] } | null {
        const patterns = this.getKeywordPatterns();
        const requiredKeywords = patterns.requiresKeywords.get(tokenValue);
        
        if (requiredKeywords) {
            return {
                suggestKeywords: true,
                requiredKeywords
            };
        }
        
        return null;
    }

    /**
     * Analyze cursor position for IntelliSense suggestions
     * 
     * Direct implementation that determines what suggestions can be provided
     * without legacy context conversion overhead.
     * 
     * @param sql - SQL text to analyze
     * @param cursorPosition - Character position (0-based)
     * @returns IntelliSense context focused on what suggestions can be provided
     */
    public static analyzeIntelliSense(sql: string, cursorPosition: number): IntelliSenseContext {
        try {
            // Get all lexemes with position information
            const allLexemes = LexemeCursor.getAllLexemesWithPosition(sql);
            
            // Find token at cursor position
            let actualTokenIndex = -1;
            let actualCurrentToken: Lexeme | undefined;
            
            // Find the token that contains or precedes the cursor
            for (let i = 0; i < allLexemes.length; i++) {
                const lexeme = allLexemes[i];
                if (!lexeme.position) continue;
                
                if (cursorPosition >= lexeme.position.startPosition && 
                    cursorPosition <= lexeme.position.endPosition) {
                    // Cursor is within this token
                    actualCurrentToken = lexeme;
                    actualTokenIndex = i;
                    break;
                } else if (lexeme.position.startPosition > cursorPosition) {
                    // Cursor is before this token (in whitespace)
                    actualTokenIndex = Math.max(0, i - 1);
                    actualCurrentToken = actualTokenIndex >= 0 ? allLexemes[actualTokenIndex] : undefined;
                    break;
                }
            }
            
            // If not found, cursor is after all tokens
            if (actualTokenIndex === -1 && allLexemes.length > 0) {
                actualTokenIndex = allLexemes.length - 1;
                actualCurrentToken = allLexemes[actualTokenIndex];
            }
            
            const previousToken = actualTokenIndex > 0 ? allLexemes[actualTokenIndex - 1] : undefined;
            
            
            // Check for dot completion (highest priority)
            const isAfterDot = this.isAfterDot(sql, cursorPosition, previousToken);
            if (isAfterDot) {
                const precedingIdentifier = this.findPrecedingIdentifier(sql, cursorPosition, allLexemes);
                return {
                    suggestTables: false,
                    suggestColumns: true,
                    suggestKeywords: false,
                    tableScope: precedingIdentifier,
                                                            currentToken: actualCurrentToken,
                    previousToken: previousToken
                };
            }
            
            // Check for keywords that require additional keywords
            if (actualCurrentToken) {
                const currentValue = actualCurrentToken.value.toLowerCase();
                const keywordRequirement = this.requiresSpecificKeywords(currentValue);
                
                if (keywordRequirement) {
                    return {
                        suggestTables: false,
                        suggestColumns: false,
                        ...keywordRequirement,
                                                                        currentToken: actualCurrentToken,
                        previousToken: previousToken
                    };
                }
            }
            
            // Check tokens for context-based suggestions
            const tokenValue = actualCurrentToken?.value.toLowerCase();
            const prevValue = previousToken?.value.toLowerCase();
            
            // Check current token first (when cursor is at end of token)
            if (tokenValue) {
                const patterns = this.getKeywordPatterns();
                
                // Keywords that suggest tables after them
                if (patterns.suggestsTables.has(tokenValue)) {
                    return {
                        suggestTables: true,
                        suggestColumns: false,
                        suggestKeywords: false,
                                                                        currentToken: actualCurrentToken,
                        previousToken: previousToken
                    };
                }
                
                // Keywords that suggest columns after them
                if (patterns.suggestsColumns.has(tokenValue)) {
                    return {
                        suggestTables: false,
                        suggestColumns: true,
                        suggestKeywords: false,
                                                                        currentToken: actualCurrentToken,
                        previousToken: previousToken
                    };
                }
            }
            
            // Check previous token (when cursor is in whitespace after token)
            if (prevValue) {
                const patterns = this.getKeywordPatterns();
                
                // Check if previous token requires specific keywords (and next token doesn't already fulfill it)
                const keywordRequirement = this.requiresSpecificKeywords(prevValue);
                if (keywordRequirement && tokenValue !== 'join' && tokenValue !== 'outer' && tokenValue !== 'by') {
                    return {
                        suggestTables: false,
                        suggestColumns: false,
                        ...keywordRequirement,
                                                                        currentToken: actualCurrentToken,
                        previousToken: previousToken
                    };
                }
                
                // Keywords that suggest tables
                if (patterns.suggestsTables.has(prevValue)) {
                    return {
                        suggestTables: true,
                        suggestColumns: false,
                        suggestKeywords: false,
                                                                        currentToken: actualCurrentToken,
                        previousToken: previousToken
                    };
                }
                
                // Keywords that suggest columns
                if (patterns.suggestsColumns.has(prevValue)) {
                    return {
                        suggestTables: false,
                        suggestColumns: true,
                        suggestKeywords: false,
                                                                        currentToken: actualCurrentToken,
                        previousToken: previousToken
                    };
                }
            }
            
            // Default fallback - suggest keywords
            return {
                suggestTables: false,
                suggestColumns: false,
                suggestKeywords: true,
                                                currentToken: actualCurrentToken,
                previousToken: previousToken
            };
            
        } catch (error) {
            // Return minimal context on error
            return {
                suggestTables: false,
                suggestColumns: false,
                suggestKeywords: false,
                            };
        }
    }

    /**
     * Analyze cursor position for IntelliSense at line/column position
     */
    public static analyzeIntelliSenseAt(sql: string, position: LineColumn): IntelliSenseContext {
        const charOffset = TextPositionUtils.lineColumnToCharOffset(sql, position);
        if (charOffset === -1) {
            return {
                suggestTables: false,
                suggestColumns: false,
                suggestKeywords: false,
                            };
        }
        return this.analyzeIntelliSense(sql, charOffset);
    }

    private static isAfterDot(sql: string, cursorPosition: number, previousToken?: Lexeme): boolean {
        // Check if character before cursor is a dot
        if (cursorPosition > 0 && sql[cursorPosition - 1] === '.') {
            return true;
        }
        
        // Check if previous token is a dot
        if (previousToken && previousToken.value === '.') {
            return true;
        }
        
        // Check for dot in nearby characters (handle whitespace)
        let pos = cursorPosition - 1;
        while (pos >= 0 && /\s/.test(sql[pos])) {
            pos--; // Skip whitespace backwards
        }
        if (pos >= 0 && sql[pos] === '.') {
            return true;
        }
        
        return false;
    }
    
    private static findPrecedingIdentifier(
        sql: string, 
        cursorPosition: number, 
        lexemes: Lexeme[]
    ): string | undefined {
        // If cursor is after a dot, look for identifier before the dot
        if (this.isAfterDot(sql, cursorPosition)) {
            // Find dot position in SQL text
            let pos = cursorPosition - 1;
            while (pos >= 0 && /\s/.test(sql[pos])) {
                pos--; // Skip whitespace backwards
            }
            if (pos >= 0 && sql[pos] === '.') {
                // Found the dot, now look for identifier before it
                let identifierEnd = pos;
                while (pos >= 0 && /\s/.test(sql[pos])) {
                    pos--; // Skip whitespace
                }
                
                // Extract identifier backwards
                while (pos >= 0 && /[a-zA-Z0-9_]/.test(sql[pos])) {
                    pos--;
                }
                const identifierStart = pos + 1;
                
                if (identifierStart < identifierEnd) {
                    return sql.substring(identifierStart, identifierEnd);
                }
            }
            
            // Fallback: try to find dot token in lexemes and get identifier before it
            for (let i = lexemes.length - 1; i >= 0; i--) {
                if (lexemes[i].value === '.' && 
                    lexemes[i].position && 
                    lexemes[i].position!.startPosition < cursorPosition) {
                    // Found a dot before cursor, get identifier before it
                    if (i > 0 && this.isIdentifier(lexemes[i - 1])) {
                        return lexemes[i - 1].value;
                    }
                    break;
                }
            }
        }
        
        return undefined;
    }
    
    
    private static isIdentifier(lexeme: Lexeme): boolean {
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(lexeme.value);
    }
    
}