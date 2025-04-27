import { Lexeme, TokenType } from "../models/Lexeme";

/**
 * Parses SQL Server-style escaped identifiers ([table]) and dot-separated identifiers.
 * Returns the list of identifiers and the new index after parsing.
 */
export function parseEscapedOrDotSeparatedIdentifiers(lexemes: Lexeme[], index: number): { identifiers: string[]; newIndex: number } {
    let idx = index;
    const identifiers: string[] = [];
    while (idx < lexemes.length) {
        if (lexemes[idx].type & TokenType.OpenBracket) {
            idx++; // skip [
            if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.Identifier)) {
                throw new Error(`Expected identifier after '[' at position ${idx}`);
            }
            identifiers.push(lexemes[idx].value);
            idx++;
            if (idx >= lexemes.length || lexemes[idx].value !== "]") {
                throw new Error(`Expected closing ']' after identifier at position ${idx}`);
            }
            idx++; // skip ]
        } else if (lexemes[idx].type & TokenType.Identifier) {
            identifiers.push(lexemes[idx].value);
            idx++;
        } else {
            break;
        }
        // Handle dot for schema.table or db.schema.table
        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Dot)) {
            idx++; // skip dot
        } else {
            break;
        }
    }
    return { identifiers, newIndex: idx };
}
