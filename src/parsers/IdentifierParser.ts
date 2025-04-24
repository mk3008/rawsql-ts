import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference, ValueComponent } from "../models/ValueComponent";

export class IdentifierParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        // Check for column reference pattern ([identifier dot] * n + identifier)
        let idx = index;
        const identifiers: string[] = [];

        // Add the first identifier
        identifiers.push(lexemes[idx].value);
        idx++;

        // Look for dot and identifier pattern
        // support wildcard '*' as identifier (e.g. select t.* from t)
        while (
            idx < lexemes.length &&
            idx + 1 < lexemes.length &&
            (lexemes[idx].type & TokenType.Dot) &&
            ((lexemes[idx + 1].type & TokenType.Identifier) || lexemes[idx + 1].value === "*")
        ) {
            // Skip the dot and add the next identifier
            idx++;
            identifiers.push(lexemes[idx].value);
            idx++;
        }

        if (identifiers.length > 1) {
            // If there are multiple identifiers, treat it as a column reference
            const lastIdentifier = identifiers.pop() || '';
            const value = new ColumnReference(identifiers, lastIdentifier);
            return { value, newIndex: idx };
        } else {
            // If there is a single identifier, treat it as a simple identifier
            const value = new ColumnReference(null, identifiers[0]);
            return { value, newIndex: idx };
        }
    }
}