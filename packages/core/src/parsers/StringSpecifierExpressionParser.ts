import { Lexeme, TokenType } from "../models/Lexeme";
import { StringSpecifierExpression, ValueComponent } from "../models/ValueComponent";

export class StringSpecifierExpressionParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        const specifer = lexemes[idx].value;
        idx++;
        if (idx >= lexemes.length || lexemes[idx].type !== TokenType.Literal) {
            throw new Error(`Expected string literal after string specifier at index ${idx}`);
        }
        const value = lexemes[idx].value;
        idx++;
        // Create StringSpecifierExpression
        const result = new StringSpecifierExpression(specifer, value);

        return { value: result, newIndex: idx };
    }
}