/**
 * Fast character classification utilities for SQL tokenization
 */
export class CharLookupTable {
    private static readonly WHITESPACE = new Set([' ', '\t', '\r', '\n']);
    private static readonly DIGITS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    private static readonly HEX_CHARS = new Set([
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'a', 'b', 'c', 'd', 'e', 'f',
        'A', 'B', 'C', 'D', 'E', 'F'
    ]);
    private static readonly DELIMITERS = new Set([' ', '.', ',', '(', ')', '+', '-', '*', '/']);
    private static readonly NAMED_PARAMETER_PREFIX = new Set(['@', ':', '$']);
    
    public static isWhitespace(char: string): boolean {
        return CharLookupTable.WHITESPACE.has(char);
    }
    
    public static isDigit(char: string): boolean {
        return CharLookupTable.DIGITS.has(char);
    }

    public static isHexChar(char: string): boolean {
        return CharLookupTable.HEX_CHARS.has(char);
    }
    
    public static isDelimiter(char: string): boolean {
        return CharLookupTable.DELIMITERS.has(char);
    }
    
    public static isNamedParameterPrefix(char: string): boolean {
        return CharLookupTable.NAMED_PARAMETER_PREFIX.has(char);
    }
}
