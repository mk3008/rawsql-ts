import { SourceAliasExpression } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";


export class SourceAliasExpressionParser {

    public static parse(lexemes: Lexeme[], index: number): { value: SourceAliasExpression; newIndex: number; } {
        let idx = index;

        if (idx < lexemes.length && lexemes[idx].type === TokenType.Identifier) {
            // Check for alias
            const table = lexemes[idx].value;
            idx++;

            if (idx < lexemes.length && lexemes[idx].type === TokenType.OpenParen) {
                // Check for column alias
                const columns: string[] = [];

                // Skip the open parenthesis
                idx++;

                while (idx < lexemes.length && lexemes[idx].type === TokenType.Identifier) {
                    columns.push(lexemes[idx].value);
                    idx++;
                    if (idx < lexemes.length && lexemes[idx].type === TokenType.Comma) {
                        idx++;
                    } else {
                        break; // Exit loop if not a comma
                    }
                }

                if (lexemes[idx].type === TokenType.CloseParen) {
                    // Skip the closing parenthesis
                    idx++;
                } else {
                    throw new Error(`Expected ')' at index ${idx}`);
                }
                if (columns.length === 0) {
                    throw new Error(`No column aliases found at index ${index}`);
                }

                return { value: new SourceAliasExpression(table, columns), newIndex: idx };
            }

            return { value: new SourceAliasExpression(table, null), newIndex: idx };
        }

        throw new Error(`Expected identifier at index ${index}`);
    }
}
