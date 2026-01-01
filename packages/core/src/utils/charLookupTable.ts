/**
 * Fast character classification utilities for SQL tokenization
 */
export class CharLookupTable {
    public static isWhitespace(char: string): boolean {
        if (char.length !== 1) return false;
        const code = char.charCodeAt(0);
        // Check for space(32), tab(9), line feed(10), carriage return(13)
        return code === 32 || code === 9 || code === 10 || code === 13;
    }

    public static isDigit(char: string): boolean {
        if (char.length !== 1) return false;
        const code = char.charCodeAt(0);
        // Check if within '0'(48) to '9'(57) range
        return code >= 48 && code <= 57;
    }

    public static isHexChar(char: string): boolean {
        if (char.length !== 1) return false;
        const code = char.charCodeAt(0);
        // Check if '0'(48) to '9'(57) or 'a'(97) to 'f'(102) or 'A'(65) to 'F'(70)
        return (code >= 48 && code <= 57) ||
            (code >= 97 && code <= 102) ||
            (code >= 65 && code <= 70);
    }

    public static isOperatorSymbol(char: string): boolean {
        if (char.length !== 1) return false;
        const code = char.charCodeAt(0);

        // Check for specific operator character codes
        // '+'=43, '-'=45, '*'=42, '/'=47, '%'=37, '~'=126, '@'=64, '#'=35, '^'=94, 
        // '&'=38, ':'=58, '!'=33, '<'=60, '>'=62, '='=61, '|'=124, '?'=63
        return code === 43 || code === 45 || code === 42 || code === 47 ||
            code === 37 || code === 126 || code === 64 || code === 35 ||
            code === 94 || code === 38 || code === 58 || code === 33 ||
            code === 60 || code === 62 || code === 61 || code === 124 || code === 63;
    }

    public static isDelimiter(char: string): boolean {
        if (char.length !== 1) return false;
        const code = char.charCodeAt(0);

        return this.isDelimiterCode(code);
    }

    public static isDelimiterCode(code: number): boolean {
        // First check delimiters: '.'=46, ','=44, '('=40, ')'=41, '['=91, ']'=93, '{'=123, '}'=125, ';'=59
        if (code === 46 || code === 44 || code === 40 || code === 41 ||
            code === 91 || code === 93 || code === 123 || code === 125 || code === 59) {
            return true;
        }

        // Then check for whitespace: ' '=32, '\t'=9, '\n'=10, '\r'=13
        if (code === 32 || code === 9 || code === 10 || code === 13) {
            return true;
        }

        // Finally check for operator symbols
        // '+'=43, '-'=45, '*'=42, '/'=47, '%'=37, '~'=126, '@'=64, '#'=35, '^'=94,
        // '&'=38, ':'=58, '!'=33, '<'=60, '>'=62, '='=61, '|'=124, '?'=63
        return code === 43 || code === 45 || code === 42 || code === 47 ||
            code === 37 || code === 126 || code === 64 || code === 35 ||
            code === 94 || code === 38 || code === 58 || code === 33 ||
            code === 60 || code === 62 || code === 61 || code === 124 || code === 63;
    }

    public static isNamedParameterPrefix(char: string): boolean {
        if (char.length !== 1) return false;
        const code = char.charCodeAt(0);

        // Check for parameter prefix characters: '@'=64, ':'=58, '$'=36
        return code === 64 || code === 58 || code === 36;
    }
}
