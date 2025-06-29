import { Lexeme, TokenType } from "../models/Lexeme";
import { IdentifierString, OverExpression } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { WindowExpressionParser } from "./WindowExpressionParser";

export class OverExpressionParser {
    public static parse(query: string): OverExpression {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The OVER expression is complete but there are additional tokens.`);
        }

        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: OverExpression; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'over') {
            throw new Error(`Syntax error at position ${idx}: Expected 'OVER' keyword but found "${lexemes[idx].value}". OVER expressions must start with the OVER keyword.`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'OVER' keyword. Expected either a window name or an opening parenthesis '('.`);
        }

        if (lexemes[idx].type & TokenType.Identifier) {
            // named window frame
            const name = lexemes[idx].value;
            idx++;
            return { value: new IdentifierString(name), newIndex: idx };
        }

        if (lexemes[idx].type & TokenType.OpenParen) {
            // Delegate processing to WindowFrameExpressionParser
            const result = WindowExpressionParser.parseFromLexeme(lexemes, idx);
            return result;
        }

        throw new Error(`Syntax error at position ${idx}: Expected a window name or opening parenthesis '(' after OVER keyword, but found "${lexemes[idx].value}".`);
    }
}
