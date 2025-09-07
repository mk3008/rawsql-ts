import { Lexeme } from "../models/Lexeme";
import { LiteralValue, RawString, ValueComponent } from "../models/ValueComponent";
import { literalKeywordParser } from "../tokenReaders/LiteralTokenReader";

export class LiteralParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        // Process literal value
        let idx = index;
        const valueText = lexemes[idx].value;
        let parsedValue: string | number | boolean | null;

        const lex = literalKeywordParser.parse(valueText.toLowerCase(), 0);
        if (lex) {
            const value = new RawString(lex.keyword);
            idx++
            return { value, newIndex: idx };
        }

        // Check if it is a number
        if (/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(valueText)) {
            parsedValue = Number(valueText);
            idx++
            const value = new LiteralValue(parsedValue);
            return { value, newIndex: idx };
        }
        // Otherwise, treat it as a string
        else {
            // Check if it's a dollar-quoted string or regular quoted string
            if (/^\$[^$]*\$[\s\S]*\$[^$]*\$$/.test(valueText)) {
                // For dollar-quoted strings, store the entire string including tags
                parsedValue = valueText;
            } else if (valueText.startsWith("'") && valueText.endsWith("'")) {
                // Remove single quotes if enclosed
                parsedValue = valueText.slice(1, -1);
            } else {
                parsedValue = valueText;
            }
            
            // Check if it was originally a quoted string literal
            const isStringLiteral = valueText.startsWith("'") && valueText.endsWith("'");
            
            idx++
            const value = new LiteralValue(parsedValue, undefined, isStringLiteral);
            return { value, newIndex: idx };
        }
    }
}