import { Lexeme, TokenType } from "../models/Lexeme";
import { ParenExpression, ValueComponent } from "../models/ValueComponent";
import { ValueParser } from "./ValueParser";

export class ParenExpressionParser {
    public static parse(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        const result = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, index);
        idx = result.newIndex;

        const value = new ParenExpression(result.value);
        return { value, newIndex: idx };
    }
}