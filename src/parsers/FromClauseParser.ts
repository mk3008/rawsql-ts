import { FromClause } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { JoinClauseParser } from "./JoinClauseParser";
import { SourceExpressionParser } from "./SourceExpressionParser";

export class FromClauseParser {
    public static parseFromText(query: string): FromClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Unexpected token at position ${result.newIndex}: ${lexemes[result.newIndex].value}`);
        }

        return result.value;
    }

    private static parse(lexemes: Lexeme[], index: number): { value: FromClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'from') {
            throw new Error(`Expected 'FROM' at index ${idx}`);
        }
        idx++;

        // Parse the main source expression
        const sourceExpression = SourceExpressionParser.parse(lexemes, idx);
        idx = sourceExpression.newIndex;

        const join = JoinClauseParser.tryParse(lexemes, idx);
        idx = join?.newIndex || idx;

        if (join !== null) {
            const clause = new FromClause(sourceExpression.value, join.value);
            return { value: clause, newIndex: idx };
        } else {
            const clause = new FromClause(sourceExpression.value, null);
            return { value: clause, newIndex: idx };
        }
    }
}