import { SourceExpression } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SourceParser } from "./SourceComponentParser";
import { SourceAliasExpressionParser } from "./SourceAliasExpressionParser";

export class SourceExpressionParser {
    public static parse(lexemes: Lexeme[], index: number): { value: SourceExpression; newIndex: number; } {
        let idx = index;

        const sourceResult = SourceParser.parse(lexemes, idx);
        idx = sourceResult.newIndex;

        if (idx < lexemes.length) {
            if (lexemes[idx].value === "as") {
                idx++;
                const aliasResult = SourceAliasExpressionParser.parse(lexemes, idx);
                idx = aliasResult.newIndex;
                const sourceExpr = new SourceExpression(sourceResult.value, aliasResult.value);
                return { value: sourceExpr, newIndex: idx };
            }

            if (lexemes[idx].type === TokenType.Identifier) {
                const aliasResult = SourceAliasExpressionParser.parse(lexemes, idx);
                idx = aliasResult.newIndex;
                const sourceExpr = new SourceExpression(sourceResult.value, aliasResult.value);
                return { value: sourceExpr, newIndex: idx };
            }
        }

        // no alias
        const expr = new SourceExpression(sourceResult.value, null);
        return { value: expr, newIndex: idx };
    }
}


