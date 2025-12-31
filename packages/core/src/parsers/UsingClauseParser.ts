import { UsingClause, SourceExpression } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SourceExpressionParser } from "./SourceExpressionParser";

/**
 * Parses the USING clause in DELETE statements.
 */
export class UsingClauseParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: UsingClause; newIndex: number } {
        if (lexemes[index].value !== "using") {
            throw new Error(`Syntax error at position ${index}: Expected 'USING' but found '${lexemes[index].value}'.`);
        }

        let idx = index + 1;
        const sources: SourceExpression[] = [];

        // Parse the first source expression referenced by USING.
        const firstSource = SourceExpressionParser.parseFromLexeme(lexemes, idx);
        sources.push(firstSource.value);
        idx = firstSource.newIndex;

        // Parse any additional sources separated by commas.
        while (lexemes[idx]?.type === TokenType.Comma) {
            idx++;
            const nextSource = SourceExpressionParser.parseFromLexeme(lexemes, idx);
            sources.push(nextSource.value);
            idx = nextSource.newIndex;
        }

        return { value: new UsingClause(sources), newIndex: idx };
    }
}
