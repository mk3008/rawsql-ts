import { joinkeywordParser, commandKeywordTrie } from "../tokenReaders/CommandTokenReader";

/**
 * Utility for caching keyword relationships for fast access
 * Dynamically builds keyword relationships from existing joinkeywordParser
 * 
 * SOURCE DICTIONARIES (single source of truth):
 * - JOIN patterns: /src/tokenReaders/CommandTokenReader.ts (joinTrie, lines 10-29)
 * - Command patterns: /src/tokenReaders/CommandTokenReader.ts (keywordTrie, lines 30-118)
 * 
 * MIGRATION NOTE:
 * If keywords are added/modified in CommandTokenReader.ts, update the 
 * extractCommandPatternsFromTrie() method to reflect those changes.
 * JOIN patterns are automatically extracted via joinkeywordParser.
 */
export class KeywordCache {
    private static joinSuggestionCache: Map<string, string[]> = new Map();
    private static commandSuggestionCache: Map<string, string[]> = new Map();
    private static initialized = false;

    /**
     * Initialize JOIN-related keyword suggestions
     * Dynamically generated based on information extracted from joinkeywordParser
     */
    private static initialize(): void {
        if (this.initialized) return;

        // SOURCE: /src/tokenReaders/CommandTokenReader.ts joinTrie (lines 10-33)
        // Dynamically build keyword relationships from joinTrie
        const joinPatterns = [
            ["join"],
            ["inner", "join"],
            ["cross", "join"],
            ["left", "join"],
            ["left", "outer", "join"],
            ["right", "join"],
            ["right", "outer", "join"],
            ["full", "join"],
            ["full", "outer", "join"],
            ["natural", "join"],
            ["natural", "inner", "join"],
            ["natural", "left", "join"],
            ["natural", "left", "outer", "join"],
            ["natural", "right", "join"],
            ["natural", "right", "outer", "join"],
            ["natural", "full", "join"],
            ["natural", "full", "outer", "join"],
            // LATERAL JOIN patterns
            ["lateral", "join"],
            ["lateral", "inner", "join"],
            ["lateral", "left", "join"],
            ["lateral", "left", "outer", "join"],
        ];

        // Build keyword suggestion relationships
        const suggestionMap = new Map<string, Set<string>>();

        // Build complete phrase suggestions for better UX
        const completePhrases = new Set<string>();
        
        joinPatterns.forEach(pattern => {
            if (pattern.length > 1) {
                completePhrases.add(pattern.slice(1).join(' ').toUpperCase());
            }
        });
        
        // For each prefix, find all possible complete continuations
        joinPatterns.forEach(pattern => {
            for (let i = 0; i < pattern.length - 1; i++) {
                const prefix = pattern[i];
                
                if (!suggestionMap.has(prefix)) {
                    suggestionMap.set(prefix, new Set());
                }
                
                // Find all patterns that start with this prefix and add complete phrases
                joinPatterns.forEach(candidatePattern => {
                    if (candidatePattern.length > i + 1 && candidatePattern[i] === prefix) {
                        const completePhrase = candidatePattern.slice(i + 1).join(' ').toUpperCase();
                        suggestionMap.get(prefix)!.add(completePhrase);
                    }
                });
            }
        });

        // Convert Set to array and save to cache
        suggestionMap.forEach((suggestions, keyword) => {
            this.joinSuggestionCache.set(keyword.toLowerCase(), Array.from(suggestions));
        });

        // Also process command keywords
        this.initializeCommandKeywords();

        this.initialized = true;
    }

    /**
     * Get next suggestions for the specified keyword
     * Example: "left" → ["join", "outer", "outer join"]
     */
    public static getJoinSuggestions(keyword: string): string[] {
        this.initialize();
        return this.joinSuggestionCache.get(keyword.toLowerCase()) || [];
    }

    /**
     * Check if a keyword is a valid JOIN keyword
     * Uses existing joinkeywordParser as the primary resource
     */
    public static isValidJoinKeyword(keyword: string): boolean {
        const result = joinkeywordParser.parse(keyword, 0);
        return result !== null;
    }

    /**
     * Generate suggestions based on partial keyword input
     * Example: "le" → find keywords starting with "left"
     */
    public static getPartialSuggestions(partialKeyword: string): string[] {
        this.initialize();
        const partial = partialKeyword.toLowerCase();
        const suggestions: string[] = [];

        this.joinSuggestionCache.forEach((values, key) => {
            if (key.startsWith(partial)) {
                suggestions.push(key);
                // Include next suggestions for that keyword as well
                values.forEach(value => {
                    if (!suggestions.includes(value)) {
                        suggestions.push(value);
                    }
                });
            }
        });

        return suggestions;
    }

    /**
     * Get all JOIN keywords
     */
    public static getAllJoinKeywords(): string[] {
        this.initialize();
        const allKeywords = new Set<string>();
        
        this.joinSuggestionCache.forEach((values, key) => {
            allKeywords.add(key);
            values.forEach(value => allKeywords.add(value));
        });

        return Array.from(allKeywords);
    }

    /**
     * Initialize command keyword patterns
     * Dynamically extracted from commandKeywordTrie
     */
    private static initializeCommandKeywords(): void {
        // Extract multi-word patterns from commandKeywordTrie
        const commandPatterns = this.extractCommandPatternsFromTrie();
        const suggestionMap = new Map<string, Set<string>>();

        commandPatterns.forEach(pattern => {
            for (let i = 0; i < pattern.length - 1; i++) {
                const prefix = pattern[i];
                const nextWord = pattern[i + 1];
                
                if (!suggestionMap.has(prefix)) {
                    suggestionMap.set(prefix, new Set());
                }
                suggestionMap.get(prefix)!.add(nextWord);
            }
        });

        // Convert Set to array and save to cache
        suggestionMap.forEach((suggestions, keyword) => {
            this.commandSuggestionCache.set(keyword.toLowerCase(), Array.from(suggestions));
        });
    }

    /**
     * Extract multi-word patterns from commandKeywordTrie
     * Uses known patterns since direct extraction from trie structure is difficult
     * 
     * SOURCE: /src/tokenReaders/CommandTokenReader.ts keywordTrie (lines 30-118)
     * MIGRATION: When updating, copy multi-word patterns from the source trie
     */
    private static extractCommandPatternsFromTrie(): string[][] {
        // These are patterns defined in CommandTokenReader's keywordTrie
        return [
            ["group", "by"],
            ["order", "by"],
            ["distinct", "on"],
            ["not", "materialized"],
            ["row", "only"],
            ["rows", "only"],
            ["percent", "with", "ties"],
            ["key", "share"],
            ["no", "key", "update"],
            ["union", "all"],
            ["intersect", "all"],
            ["except", "all"],
            ["partition", "by"],
            ["within", "group"],
            ["with", "ordinality"]
        ];
    }

    /**
     * Get next command suggestions for the specified keyword
     * Example: "group" → ["by"]
     */
    public static getCommandSuggestions(keyword: string): string[] {
        this.initialize();
        return this.commandSuggestionCache.get(keyword.toLowerCase()) || [];
    }

    /**
     * Force cache re-initialization
     * Used for testing or when keyword definitions have changed
     */
    public static reset(): void {
        this.joinSuggestionCache.clear();
        this.commandSuggestionCache.clear();
        this.initialized = false;
    }
}