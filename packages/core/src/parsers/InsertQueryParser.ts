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
import { IdentifierString } from "../models/ValueComponent";
import { extractLexemeComments } from "./utils/LexemeCommentUtils";

export class InsertQueryParser {
    /**
     * Parse SQL string to InsertQuery AST.
     * @param query SQL string
     */
    public static parse(query: string): InsertQuery {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexemes();
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

        const insertKeywordLexeme = lexemes[idx];
        const insertKeywordComments = extractLexemeComments(insertKeywordLexeme);
        idx++;

        const sourceResult = SourceExpressionParser.parseTableSourceFromLexemes(lexemes, idx);
        const targetSource = sourceResult.value;
        const targetDatasource = targetSource.datasource;
        idx = sourceResult.newIndex;

        // Route inline comments immediately following INSERT INTO to the table reference.
        if (insertKeywordComments.after.length > 0) {
            targetDatasource.addPositionedComments("before", insertKeywordComments.after);
        }

        let columnIdentifiers: IdentifierString[] | null = null;
        let trailingInsertComments: string[] = [];
        if (lexemes[idx]?.type === TokenType.OpenParen) {
            const openParenLexeme = lexemes[idx];
            const parenComments = extractLexemeComments(openParenLexeme);
            idx++;

            if (parenComments.before.length > 0) {
                // Comments before '(' belong after the table name.
                targetDatasource.addPositionedComments("after", parenComments.before);
            }

            columnIdentifiers = [];
            let pendingBeforeForNext: string[] = [...parenComments.after];

            while (idx < lexemes.length && (lexemes[idx].type & TokenType.Identifier)) {
                const columnLexeme = lexemes[idx];
                const columnComments = extractLexemeComments(columnLexeme);
                const column = new IdentifierString(columnLexeme.value);

                // Attach leading comments gathered from preceding tokens and the identifier itself.
                const beforeComments: string[] = [];
                if (pendingBeforeForNext.length > 0) {
                    beforeComments.push(...pendingBeforeForNext);
                }
                if (columnComments.before.length > 0) {
                    beforeComments.push(...columnComments.before);
                }
                if (beforeComments.length > 0) {
                    column.addPositionedComments("before", beforeComments);
                }

                if (columnComments.after.length > 0) {
                    column.addPositionedComments("after", columnComments.after);
                }

                columnIdentifiers.push(column);
                pendingBeforeForNext = [];
                idx++;

                if (lexemes[idx]?.type === TokenType.Comma) {
                    const commaComments = extractLexemeComments(lexemes[idx]);
                    pendingBeforeForNext = [...commaComments.after];
                    idx++;
                    continue;
                }

                break;
            }

            if (pendingBeforeForNext.length > 0 && columnIdentifiers.length > 0) {
                columnIdentifiers[columnIdentifiers.length - 1].addPositionedComments("after", pendingBeforeForNext);
                pendingBeforeForNext = [];
            }

            if (lexemes[idx]?.type !== TokenType.CloseParen) {
                throw new Error(`Syntax error at position ${idx}: Expected ')' after column list.`);
            }

            const closeParenComments = extractLexemeComments(lexemes[idx]);
            idx++;

            if (closeParenComments.before.length > 0 && columnIdentifiers.length > 0) {
                columnIdentifiers[columnIdentifiers.length - 1].addPositionedComments("after", closeParenComments.before);
            }
            if (closeParenComments.after.length > 0) {
                // Comments after ')' should trail the entire INSERT clause.
                trailingInsertComments = closeParenComments.after;
            }

            if (columnIdentifiers.length === 0) {
                columnIdentifiers = [];
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

        const insertClause = new InsertClause(targetSource, columnIdentifiers ?? null);
        if (insertKeywordComments.before.length > 0) {
            insertClause.addPositionedComments("before", insertKeywordComments.before);
        }
        if (trailingInsertComments.length > 0) {
            insertClause.addPositionedComments("after", trailingInsertComments);
        }

        return {
            value: new InsertQuery({
                withClause,
                insertClause,
                selectQuery: dataQuery,
                returning: returningClause
            }),
            newIndex: idx
        };
    }
}

