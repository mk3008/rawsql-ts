import { Lexeme, TokenType } from "../models/Lexeme";
import { IdentifierString } from "../models/ValueComponent";

/**
 * Utility class for parsing fully qualified names (e.g. db.schema.table or db.schema.table.column_name)
 * This can be used for both table and column references.
 */
export class FullNameParser {
    /**
     * Parses a fully qualified name from lexemes, returning namespaces, table, and new index.
     */
    public static parse(lexemes: Lexeme[], index: number): { namespaces: string[] | null, name: IdentifierString, newIndex: number } {
        const { identifiers, newIndex } = FullNameParser.parseEscapedOrDotSeparatedIdentifiers(lexemes, index);
        const { namespaces, name } = FullNameParser.extractNamespacesAndName(identifiers);
        return { namespaces, name: new IdentifierString(name), newIndex };
    }

    // Parses SQL Server-style escaped identifiers ([table]) and dot-separated identifiers.
    private static parseEscapedOrDotSeparatedIdentifiers(lexemes: Lexeme[], index: number): { identifiers: string[]; newIndex: number } {
        let idx = index;
        const identifiers: string[] = [];
        while (idx < lexemes.length) {
            if (lexemes[idx].type & TokenType.OpenBracket) { // TokenType.OpenBracket = 1 << 9
                idx++; // skip [
                if (idx >= lexemes.length || !((lexemes[idx].type & TokenType.Identifier) || (lexemes[idx].type & TokenType.Command))) {
                    throw new Error(`Expected identifier after '[' at position ${idx}`);
                }
                identifiers.push(lexemes[idx].value);
                idx++;
                if (idx >= lexemes.length || lexemes[idx].value !== "]") {
                    throw new Error(`Expected closing ']' after identifier at position ${idx}`);
                }
                idx++; // skip ]
            } else if ((lexemes[idx].type & TokenType.Identifier) || (lexemes[idx].type & TokenType.Function)) {
                // In the case of an INSERT statement, such as `insert into users (`, the table name `users` may be mistakenly recognized as a Function token.
                // Therefore, FullNameParser treats such tokens as identifiers and ignores the Function type in this context.
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

    // Utility to extract namespaces and the final name from an array of identifiers
    // Example: ["db", "schema", "users"] => { namespaces: ["db", "schema"], name: "users" }
    private static extractNamespacesAndName(identifiers: string[]): { namespaces: string[] | null, name: string } {
        if (!identifiers || identifiers.length === 0) {
            throw new Error("Identifier list is empty");
        }
        if (identifiers.length === 1) {
            return { namespaces: null, name: identifiers[0] };
        }
        return {
            namespaces: identifiers.slice(0, -1),
            name: identifiers[identifiers.length - 1]
        };
    }
}
