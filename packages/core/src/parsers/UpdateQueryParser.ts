// Provides parsing for UPDATE queries, supporting SET, WHERE, FROM, and RETURNING clauses.
import { UpdateQuery } from "../models/UpdateQuery";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { UpdateClauseParser } from "./UpdateClauseParser";
import { WhereClauseParser } from "./WhereClauseParser";
import { ReturningClauseParser } from "./ReturningClauseParser";
import { FromClauseParser } from "./FromClauseParser";
import { FromClause, ReturningClause, WhereClause, WithClause } from "../models/Clause";
import { SetClauseParser } from "./SetClauseParser";
import { WithClauseParser } from "./WithClauseParser";
import { extractLexemeComments } from "./utils/LexemeCommentUtils";

export class UpdateQueryParser {
    /**
     * Parse SQL string to UpdateQuery AST.
     * @param query SQL string
     */
    public static parse(query: string): UpdateQuery {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The UPDATE query is complete but there are additional tokens.`);
        }
        return result.value;
    }

    /**
     * Parse from lexeme array (for internal use and tests)
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: UpdateQuery; newIndex: number } {

        let idx = index;

        // Parse optional WITH clause (CTE)
        let withClause: WithClause | null = null;
        if (lexemes[idx]?.value?.toLowerCase() === "with") {
            const withResult = WithClauseParser.parseFromLexeme(lexemes, idx);
            withClause = withResult.value;
            idx = withResult.newIndex;
        }

        // Expect UPDATE
        if (lexemes[idx].value !== "update") {
            throw new Error(`Syntax error at position ${idx}: Expected 'UPDATE' but found '${lexemes[idx].value}'.`);
        }
        const updateLexeme = lexemes[idx];
        const updateKeywordComments = extractLexemeComments(updateLexeme);
        idx++;

        // Parse updateClause (table or source expression)
        const updateClauseResult = UpdateClauseParser.parseFromLexeme(lexemes, idx);
        const updateClause = updateClauseResult.value;
        idx = updateClauseResult.newIndex;

        // Attach positioned comments captured from the UPDATE keyword.
        if (updateKeywordComments.before.length > 0) {
            updateClause.addPositionedComments("before", updateKeywordComments.before);
        }
        if (updateKeywordComments.after.length > 0) {
            updateClause.addPositionedComments("after", updateKeywordComments.after);
        }

        // Parse set clause (including 'SET' keyword check)
        const setClauseResult = SetClauseParser.parseFromLexeme(lexemes, idx);
        let setClause = setClauseResult.setClause;
        idx = setClauseResult.newIndex;

        // Optional FROM (not always supported in all dialects)
        let from: FromClause | null = null;
        if (lexemes[idx]?.value === "from") {
            const result = FromClauseParser.parseFromLexeme(lexemes, idx);
            from = result.value;
            idx = result.newIndex;
        }

        // Optional WHERE
        let where: WhereClause | null = null;
        if (lexemes[idx]?.value === "where") {
            const result = WhereClauseParser.parseFromLexeme(lexemes, idx);
            where = result.value;
            idx = result.newIndex;
        }

        // Optional RETURNING
        let returning: ReturningClause | null = null;
        if (lexemes[idx]?.value === "returning") {
            const result = ReturningClauseParser.parseFromLexeme(lexemes, idx);
            returning = result.value;
            idx = result.newIndex;
        }

        return {
            value: new UpdateQuery({
                withClause,
                updateClause,
                setClause,
                whereClause: where,
                fromClause: from,
                returning
            }),
            newIndex: idx
        };
    }
}

