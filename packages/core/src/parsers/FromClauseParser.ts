import { FromClause } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { JoinClauseParser } from "./JoinClauseParser";
import { SourceExpressionParser } from "./SourceExpressionParser";
import { CommentUtils } from "../utils/CommentUtils";

export class FromClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): FromClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The FROM clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: FromClause; newIndex: number } {
        let idx = index;

        // Capture comments associated with the FROM clause
        const fromTokenComments = CommentUtils.collectClauseComments(lexemes, idx, 'from');

        if (lexemes[idx].value !== 'from') {
            throw new Error(`Syntax error at position ${idx}: Expected 'FROM' keyword but found "${lexemes[idx].value}". FROM clauses must start with the FROM keyword.`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'FROM' keyword. The FROM clause requires a table reference.`);
        }

        // Parse the main source expression
        const sourceExpression = SourceExpressionParser.parseFromLexeme(lexemes, idx);
        idx = sourceExpression.newIndex;

        const join = JoinClauseParser.tryParse(lexemes, idx);
        idx = join?.newIndex || idx;

        if (join !== null) {
            const clause = new FromClause(sourceExpression.value, join.value);
            // Set comments from the FROM token to the clause
            clause
            return { value: clause, newIndex: idx };
        } else {
            const clause = new FromClause(sourceExpression.value, null);
            // Set comments from the FROM token to the clause
            clause
            return { value: clause, newIndex: idx };
        }
    }
}