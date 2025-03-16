export enum TokenType {
    Literal,
    Operator,
    OpenParen,
    CloseParen,
    Comma,
    Dot,
    Identifier,
    Command, // select, from, where as, on, etc.
    Parameter,
    OpenBracket,
    CloseBracket,
    Function, // count, sum, etc.
}

/**
 * Represents a lexical token in SQL parsing
 */
export interface Lexeme {
    type: TokenType;
    value: string;
    command?: string;
}
