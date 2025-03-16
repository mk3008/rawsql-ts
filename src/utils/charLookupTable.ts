/**
    // No changes needed in this file as the OPERATORS set already exists
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
    private static readonly DELIMITERS = new Set(['.', ',', '(', ')']);
    private static readonly NAMED_PARAMETER_PREFIX = new Set([
        '@', // SQL Server
        ':', // Oracle, PostgreSQL
        '$', // PostgreSQL, MySQL  
    ]);
    private static readonly OPERATORS = new Set([
        '+', // Addition operator (Common)
        '-', // Subtraction operator (Common)
        '*', // Multiplication operator (Common)
        '/', // Division operator (Common)
        '%', // Modulus operator (Common)
        '~', // Bitwise NOT operator / Regular expression match (PostgreSQL, MySQL)
        '@', // Euclidean distance / Array operations (SQL Server, PostgreSQL)
        '#', // JSON operations (PostgreSQL, MySQL)
        '^', // Exponentiation / XOR operator (PostgreSQL, MySQL)
        '&', // Bitwise AND operator (Common)
        ':', // Postgres type cast operator :: (PostgreSQL)
        '!', // Logical NOT operator (Common)
        '<', // Less than operator (Common)
        '>', // Greater than operator (Common)
        '=', // Assignment or equality operator (Common)
        '|', // Bitwise OR operator (Common)
    ]);

    public static isWhitespace(char: string): boolean {
        return CharLookupTable.WHITESPACE.has(char);
    }

    public static isDigit(char: string): boolean {
        return CharLookupTable.DIGITS.has(char);
    }

    public static isHexChar(char: string): boolean {
        return CharLookupTable.HEX_CHARS.has(char);
    }

    public static isOperator(char: string): boolean {
        return CharLookupTable.OPERATORS.has(char);
    }

    public static isDelimiter(char: string): boolean {
        if (CharLookupTable.DELIMITERS.has(char)) {
            return true;
        }
        else if (CharLookupTable.isWhitespace(char)) {
            return true;
        }
        else if (CharLookupTable.isOperator(char)) {
            return true;
        }
        return false;
    }

    public static isNamedParameterPrefix(char: string): boolean {
        return CharLookupTable.NAMED_PARAMETER_PREFIX.has(char);
    }
}
