// Provides parsing for DELETE statements, supporting WITH, USING, WHERE, and RETURNING clauses.
import { DeleteQuery } from "../models/DeleteQuery";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { DeleteClauseParser } from "./DeleteClauseParser";
import { UsingClauseParser } from "./UsingClauseParser";
import { WhereClauseParser } from "./WhereClauseParser";
import { ReturningClauseParser } from "./ReturningClauseParser";
import { DeleteClause, ReturningClause, UsingClause, WhereClause, WithClause } from "../models/Clause";
import { WithClauseParser } from "./WithClauseParser";

export class DeleteQueryParser {
    /**
     * Parse SQL string to DeleteQuery AST.
     * @param query SQL string
     */
    public static parse(query: string): DeleteQuery {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);

        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The DELETE query is complete but there are additional tokens.`);
        }

        return result.value;
    }

    /**
     * Parse from lexeme array (for internal use and tests).
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: DeleteQuery; newIndex: number } {
        let idx = index;

        // Parse optional WITH clause before the DELETE command.
        let withClause: WithClause | null = null;
        if (lexemes[idx]?.value === "with") {
            const withResult = WithClauseParser.parseFromLexeme(lexemes, idx);
            withClause = withResult.value;
            idx = withResult.newIndex;
        }

        // Parse the mandatory DELETE FROM clause.
        const deleteClauseResult = DeleteClauseParser.parseFromLexeme(lexemes, idx);
        const deleteClause: DeleteClause = deleteClauseResult.value;
        idx = deleteClauseResult.newIndex;

        // Parse optional USING clause that supplies joined tables.
        let usingClause: UsingClause | null = null;
        if (lexemes[idx]?.value === "using") {
            const usingResult = UsingClauseParser.parseFromLexeme(lexemes, idx);
            usingClause = usingResult.value;
            idx = usingResult.newIndex;
        }

        // Parse optional WHERE clause restricting deleted rows.
        let whereClause: WhereClause | null = null;
        if (lexemes[idx]?.value === "where") {
            const whereResult = WhereClauseParser.parseFromLexeme(lexemes, idx);
            whereClause = whereResult.value;
            idx = whereResult.newIndex;
        }

        // Parse optional RETURNING clause to capture output columns.
        let returningClause: ReturningClause | null = null;
        if (lexemes[idx]?.value === "returning") {
            const returningResult = ReturningClauseParser.parseFromLexeme(lexemes, idx);
            returningClause = returningResult.value;
            idx = returningResult.newIndex;
        }

        return {
            value: new DeleteQuery({
                withClause,
                deleteClause,
                usingClause,
                whereClause,
                returning: returningClause
            }),
            newIndex: idx
        };
    }
}
