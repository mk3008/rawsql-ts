import { Lexeme } from "../models/Lexeme";
import { ParameterExpression, ValueComponent } from "../models/ValueComponent";

export class ParameterExpressionParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        // Exclude the parameter symbol (first character)
        const value = new ParameterExpression(lexemes[idx].value.slice(1));
        idx++;
        return { value, newIndex: idx };
    }
}