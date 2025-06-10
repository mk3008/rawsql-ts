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

    public static parseTableSourceFromLexemes(lexemes: Lexeme[], index: number): { value: SourceExpression; newIndex: number } {
        const result = SourceParser.parseTableSourceFromLexemes(lexemes, index);
        // No alias for table source
        const sourceExpr = new SourceExpression(result.value, null);
        return { value: sourceExpr, newIndex: result.newIndex };
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

            /**
             * Explanation:
             * Source aliases are typically identified as TokenType.Identifier.
             * However, when the 'AS' keyword is omitted and column alias names are specified,
             * they may sometimes be classified as TokenType.Function.
             * Since the TokenReader's responsibility is to perform coarse-grained classification,
             * the parser must interpret subsequent 'Function' tokens as source alias expressions
             * when they follow a source definition.
             * Example:
             * SQL: select t.* from (values(1)) t(id)
             * Explanation: The alias 't' and its column alias 'id' are parsed as a source alias expression.
             */
            if (idx < lexemes.length && this.isTokenTypeAliasCandidate(lexemes[idx].type)) {
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

    private static isTokenTypeAliasCandidate(type: number): boolean {
        return (type & TokenType.Identifier) !== 0 || (type & TokenType.Function) !== 0;
    }
}
