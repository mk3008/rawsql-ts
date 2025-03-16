export enum TokenType {
    Unknown,
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
    Comment,
    Function, // count, sum, etc.
}
