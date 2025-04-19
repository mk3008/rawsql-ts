import { Lexeme, TokenType } from "../models/Lexeme";
import { InlineQuery, ParenExpression, ValueComponent } from "../models/ValueComponent";
import { SelectQueryParser } from "./SelectQueryParser";
import { ValueParser } from "./ValueParser";

export class ParenExpressionParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // check inline query
        if (idx + 1 < lexemes.length && lexemes[idx].type === TokenType.OpenParen && (
            lexemes[idx + 1].value === "select" || lexemes[idx + 1].value === "values" || lexemes[idx + 1].value === "with"
        )) {
            idx += 1; // Skip the '(' token
            const result = SelectQueryParser.parseFromLexeme(lexemes, idx);
            idx = result.newIndex;

            // Check for closing parenthesis
            if (idx >= lexemes.length || lexemes[idx].type !== TokenType.CloseParen) {
                throw new Error(`Expected ')' at index ${idx}, but found ${lexemes[idx].value}`);
            }
            idx++; // Skip the ')' token

            const value = new InlineQuery(result.value);
            return { value, newIndex: idx };
        } else {
            const result = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, index);
            idx = result.newIndex;

            const value = new ParenExpression(result.value);
            return { value, newIndex: idx };
        }
    }
}