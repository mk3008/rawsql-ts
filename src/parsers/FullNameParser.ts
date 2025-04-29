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

    // Parses SQL Server-style escaped identifiers ([table]) and dot-separated identifiers, including namespaced wildcards (e.g., db.schema.*, [db].[schema].*)
    private static parseEscapedOrDotSeparatedIdentifiers(lexemes: Lexeme[], index: number): { identifiers: string[]; newIndex: number } {
        let idx = index;
        const identifiers: string[] = [];
        while (idx < lexemes.length) {
            if (lexemes[idx].type & TokenType.OpenBracket) {
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
            } else if (lexemes[idx].type & TokenType.Identifier) {
                identifiers.push(lexemes[idx].value);
                idx++;
            } else if (lexemes[idx].type & TokenType.Function) {
                // The function token is always treated as the terminal part of a qualified name in SQL (e.g., db.schema.myfunc or [db].[schema].[myfunc]).
                // No valid SQL syntax allows a function token in the middle of a multi-part name.
                identifiers.push(lexemes[idx].value);
                idx++;
                break;
            } else if (lexemes[idx].value === "*") {
                // The wildcard '*' is always treated as the terminal part of a qualified name in SQL (e.g., db.schema.* or [db].[schema].*).
                // No valid SQL syntax allows a wildcard in the middle of a multi-part name.
                identifiers.push(lexemes[idx].value);
                idx++;
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
        return { namespaces: identifiers.slice(0, -1), name: identifiers[identifiers.length - 1] };
    }
}
