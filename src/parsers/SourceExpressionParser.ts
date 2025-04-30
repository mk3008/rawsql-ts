import { SourceAliasExpression, SourceExpression, TableSource } from "../models/Clause";
import { SqlTokenizer } from "./SqlTokenizer";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SourceParser } from "./SourceParser";
import { SourceAliasExpressionParser } from "./SourceAliasExpressionParser";

export class SourceExpressionParser {
    /**
     * Parse SQL string to SourceExpression (e.g. "table", "table as t", "schema.table t")
     */
    public static parse(query: string): SourceExpression {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The source expression is complete but there are additional tokens.`);
        }
        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: SourceExpression; newIndex: number; } {
        let idx = index;

        const sourceResult = SourceParser.parseFromLexeme(lexemes, idx);
        idx = sourceResult.newIndex;

        if (idx < lexemes.length) {
            if (lexemes[idx].value === "as") {
                idx++;
                const aliasResult = SourceAliasExpressionParser.parseFromLexeme(lexemes, idx);
                idx = aliasResult.newIndex;
                const sourceExpr = new SourceExpression(sourceResult.value, aliasResult.value);
                return { value: sourceExpr, newIndex: idx };
            }

            if (lexemes[idx].type & TokenType.Identifier) {
                const aliasResult = SourceAliasExpressionParser.parseFromLexeme(lexemes, idx);
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
