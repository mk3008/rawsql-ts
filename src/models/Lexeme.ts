export enum TokenType {
    Literal,
    Operator,
    OpenParen,
    CloseParen,
    Comma,
    Dot,
    Identifier,
    Command, // select, from, where as, on, array etc
    Parameter,
    OpenBracket,
    CloseBracket,
    Function, // next token is open paren
    StringSpecifier, // next token is string literal
    Type, // column type
}

/**
 * Represents a lexical token in SQL parsing
 */
export interface Lexeme {
    type: TokenType;
    value: string;
    comments: string[] | null;
}
