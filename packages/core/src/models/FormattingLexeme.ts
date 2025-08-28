import { Lexeme, LexemePosition } from './Lexeme';

/**
 * Extended lexeme interface that preserves formatting information
 */
export interface FormattingLexeme extends Lexeme {
    /**
     * Whitespace that follows this lexeme (spaces, tabs, newlines)
     */
    followingWhitespace: string;
    
    /**
     * Inline comments that appear on the same line as this lexeme
     */
    inlineComments: string[];
    
    /**
     * Enhanced position information for precise reconstruction
     */
    position: LexemePosition;
}

/**
 * Metadata for tracking modifications during AST transformations
 */
export interface ModificationInfo {
    /**
     * Map of original values to new values for renamed items
     */
    renames: Map<string, string>;
    
    /**
     * Positions where new content was inserted
     */
    insertions: Array<{ position: number; content: string }>;
    
    /**
     * Ranges that were deleted from original content
     */
    deletions: Array<{ start: number; end: number }>;
}

/**
 * Container for formatting information associated with AST nodes
 */
export interface FormattingInfo {
    /**
     * Original lexemes with formatting information
     */
    originalLexemes: FormattingLexeme[];
    
    /**
     * Start position in original text
     */
    startPosition: number;
    
    /**
     * End position in original text
     */
    endPosition: number;
    
    /**
     * Modifications made during transformations
     */
    modifications?: ModificationInfo;
    
    /**
     * Original whitespace patterns for reconstruction
     */
    whitespacePatterns?: string[];
}