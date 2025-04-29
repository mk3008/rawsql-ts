import { FullNameParser } from "./FullNameParser";
import { Lexeme } from "../models/Lexeme";
import { ColumnReference, ValueComponent } from "../models/ValueComponent";

export class IdentifierParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        // Use FullNameParser to robustly parse qualified identifiers, including wildcards and escaped names.
        const { namespaces, name, newIndex } = FullNameParser.parse(lexemes, index);
        const value = new ColumnReference(namespaces, name);
        return { value, newIndex };
    }
}