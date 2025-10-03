import { WhereClause } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";
import { CommentUtils } from "../utils/CommentUtils";

export class WhereClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): WhereClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The WHERE clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: WhereClause; newIndex: number } {
        let idx = index;

        // Capture comments associated with the WHERE clause
        const whereLexeme = lexemes[idx];
        const whereTokenComments = CommentUtils.collectClauseComments(lexemes, idx, 'where');
        // Preserve positioned comments from the WHERE keyword so we can reapply them during printing
        const wherePositionedComments = whereLexeme.positionedComments;

        if (whereLexeme.value !== 'where') {
            throw new Error(`Syntax error at position ${idx}: Expected 'WHERE' keyword but found "${lexemes[idx].value}". WHERE clauses must start with the WHERE keyword.`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'WHERE' keyword. The WHERE clause requires a condition expression.`);
        }

        const item = ValueParser.parseFromLexeme(lexemes, idx);
        const clause = new WhereClause(item.value);
        // Set comments from the WHERE token to the clause
        clause.comments = whereTokenComments;

        if (wherePositionedComments && wherePositionedComments.length > 0) {
            // Clone positioned comments so mutations on the clause do not leak back to the tokenizer state
            clause.positionedComments = wherePositionedComments.map((comment) => ({
                position: comment.position,
                comments: [...comment.comments],
            }));
        }

        return { value: clause, newIndex: item.newIndex };
    }
}