export enum TokenType {
    None = 0,
    Literal = 1 << 0,
    Operator = 1 << 1,
    OpenParen = 1 << 2,
    CloseParen = 1 << 3,
    Comma = 1 << 4,
    Dot = 1 << 5,
    Identifier = 1 << 6,
    Command = 1 << 7, // select, from, where as, on, array etc
    Parameter = 1 << 8,
    OpenBracket = 1 << 9,
    CloseBracket = 1 << 10,
    Function = 1 << 11, // next token is open paren
    StringSpecifier = 1 << 12, // next token is string literal
    Type = 1 << 13,
}

/**
 * Position information for a lexeme in the source text
 */
export interface LexemePosition {
    startPosition: number;  // Character offset in source
    endPosition: number;    // Character offset in source
    startLine?: number;     // Line number (1-based)
    startColumn?: number;   // Column number (1-based)
    endLine?: number;       // Line number (1-based)
    endColumn?: number;     // Column number (1-based)
}

/**
 * Represents a lexical token in SQL parsing
 */
export interface Lexeme {
    type: number; // Bit flags for TokenType
    value: string;
    comments: string[] | null;
    position?: LexemePosition; // Optional position information for cursor-to-lexeme mapping
}
