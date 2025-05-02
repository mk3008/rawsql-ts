import { Lexeme } from "../models/Lexeme";
import { ParameterExpression, ValueComponent } from "../models/ValueComponent";

export class ParameterExpressionParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        let paramName = lexemes[idx].value;

        // Normalize parameter: Remove the parameter symbol and extract the parameter name.
        if (paramName.startsWith('${') && paramName.endsWith('}')) {
            // ${name} → name
            paramName = paramName.slice(2, -1);
        } else {
            // :name → name
            paramName = paramName.slice(1);
        }

        const value = new ParameterExpression(paramName);
        idx++;
        return { value, newIndex: idx };
    }
}