import { HavingClause } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class HavingClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): HavingClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The HAVING clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: HavingClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'having') {
            throw new Error(`Syntax error at position ${idx}: Expected 'HAVING' keyword but found "${lexemes[idx].value}". HAVING clauses must start with the HAVING keyword.`);
        }
        const havingKeywordComments = lexemes[idx].positionedComments;
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'HAVING' keyword. The HAVING clause requires a condition expression.`);
        }

        const item = ValueParser.parseFromLexeme(lexemes, idx);
        const afterKeywordComments = havingKeywordComments
            ?.filter(comment => comment.position === 'after')
            .flatMap(comment => comment.comments) ?? [];
        if (afterKeywordComments.length > 0) {
            item.value.addPositionedComments('before', afterKeywordComments);
        }
        const clause = new HavingClause(item.value);

        return { value: clause, newIndex: item.newIndex };
    }
}
