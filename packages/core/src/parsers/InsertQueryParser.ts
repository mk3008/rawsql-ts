// filepath: src/parsers/InsertQueryParser.ts
// Provides parsing for INSERT queries, supporting optional columns and WITH/SELECT/VALUES structure.
import { InsertQuery } from "../models/InsertQuery";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { SelectQuery } from "../models/SelectQuery";
import { SelectQueryParser } from "./SelectQueryParser";
import { InsertClause, ReturningClause, WithClause } from "../models/Clause";
import { WithClauseParser } from "./WithClauseParser";
import { SourceExpressionParser } from "./SourceExpressionParser";
import { ValuesQueryParser } from "./ValuesQueryParser";
import { ReturningClauseParser } from "./ReturningClauseParser";

export class InsertQueryParser {
    /**
     * Parse SQL string to InsertQuery AST.
     * @param query SQL string
     */
    public static parse(query: string): InsertQuery {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The INSERT query is complete but there are additional tokens.`);
        }
        return result.value;
    }

    /**
     * Parse from lexeme array (for internal use and tests)
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: InsertQuery; newIndex: number } {
        let idx = index;

        let withClause: WithClause | null = null;
        if (lexemes[idx]?.value === "with") {
            const result = WithClauseParser.parseFromLexeme(lexemes, idx);
            withClause = result.value;
            idx = result.newIndex;
        }

        if (!lexemes[idx] || lexemes[idx].value !== "insert into") {
            const found = lexemes[idx]?.value ?? "end of input";
            throw new Error(`Syntax error at position ${idx}: Expected 'INSERT INTO' but found '${found}'.`);
        }
        idx++;

        const sourceResult = SourceExpressionParser.parseTableSourceFromLexemes(lexemes, idx);
        idx = sourceResult.newIndex;

        let columns: string[] | null = null;
        if (lexemes[idx]?.type === TokenType.OpenParen) {
            idx++;
            columns = [];
            while (idx < lexemes.length && lexemes[idx].type === TokenType.Identifier) {
                columns.push(lexemes[idx].value);
                idx++;
                if (lexemes[idx]?.type === TokenType.Comma) {
                    idx++;
                } else {
                    break;
                }
            }
            if (lexemes[idx]?.type !== TokenType.CloseParen) {
                throw new Error(`Syntax error at position ${idx}: Expected ')' after column list.`);
            }
            idx++;
            if (columns.length === 0) {
                columns = [];
            }
        }

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input while parsing INSERT statement. VALUES or SELECT clause expected.`);
        }

        const nextToken = lexemes[idx].value.toLowerCase();
        let dataQuery: SelectQuery;
        if (nextToken === "values") {
            const valuesResult = ValuesQueryParser.parseFromLexeme(lexemes, idx);
            dataQuery = valuesResult.value;
            idx = valuesResult.newIndex;
        } else {
            const selectResult = SelectQueryParser.parseFromLexeme(lexemes, idx);
            dataQuery = selectResult.value;
            idx = selectResult.newIndex;
        }

        let returningClause: ReturningClause | null = null;
        if (lexemes[idx]?.value === "returning") {
            const returningResult = ReturningClauseParser.parseFromLexeme(lexemes, idx);
            returningClause = returningResult.value;
            idx = returningResult.newIndex;
        }

        return {
            value: new InsertQuery({
                withClause,
                insertClause: new InsertClause(sourceResult.value, columns ?? null),
                selectQuery: dataQuery,
                returning: returningClause
            }),
            newIndex: idx
        };
    }
}
