import { MergeQuery, MergeWhenClause, MergeMatchType, MergeUpdateAction, MergeDeleteAction, MergeInsertAction, MergeDoNothingAction } from "../models/MergeQuery";
import { SetClause, SetClauseItem, SourceExpression, WhereClause, WithClause } from "../models/Clause";
import { IdentifierString, ValueComponent, ValueList } from "../models/ValueComponent";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { WithClauseParser } from "./WithClauseParser";
import { SourceExpressionParser } from "./SourceExpressionParser";
import { ValueParser } from "./ValueParser";
import { WhereClauseParser } from "./WhereClauseParser";
import { FullNameParser } from "./FullNameParser";

export class MergeQueryParser {
    /**
     * Parse SQL string to MergeQuery AST.
     * @param query SQL string
     */
    public static parse(query: string): MergeQuery {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The MERGE statement is complete but there are additional tokens.`);
        }
        return result.value;
    }

    /**
     * Parse from lexeme array (for internal use and tests).
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: MergeQuery; newIndex: number } {
        let idx = index;

        // Parse optional WITH clause wrapping the MERGE statement for CTE support.
        let withClause: WithClause | null = null;
        if (lexemes[idx]?.value === "with") {
            const withResult = WithClauseParser.parseFromLexeme(lexemes, idx);
            withClause = withResult.value;
            idx = withResult.newIndex;
        }

        // Ensure the statement begins with MERGE INTO.
        if (lexemes[idx]?.value !== "merge into") {
            const actual = lexemes[idx]?.value ?? "end of input";
            throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected 'MERGE INTO' but found '${actual}'.`);
        }
        idx++;

        // Parse target source expression (table or alias assignment).
        const targetResult = SourceExpressionParser.parseFromLexeme(lexemes, idx);
        const target = targetResult.value;
        idx = targetResult.newIndex;

        // Consume USING clause introducing the source relation.
        if (lexemes[idx]?.value !== "using") {
            const actual = lexemes[idx]?.value ?? "end of input";
            throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected 'USING' but found '${actual}'.`);
        }
        idx++;

        // Parse source expression providing the dataset to merge with target.
        const sourceResult = SourceExpressionParser.parseFromLexeme(lexemes, idx);
        const source = sourceResult.value;
        idx = sourceResult.newIndex;

        // Require ON clause defining the match predicate.
        if (lexemes[idx]?.value !== "on") {
            const actual = lexemes[idx]?.value ?? "end of input";
            throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected 'ON' but found '${actual}'.`);
        }
        idx++;

        // Parse ON condition allowing any valid boolean expression.
        const onConditionResult = ValueParser.parseFromLexeme(lexemes, idx);
        const onCondition = onConditionResult.value;
        idx = onConditionResult.newIndex;

        // Accumulate WHEN clauses that describe matched and unmatched behaviors.
        const whenResult = this.parseWhenClauses(lexemes, idx);
        if (whenResult.clauses.length === 0) {
            throw new Error("[MergeQueryParser] MERGE statement must contain at least one WHEN clause.");
        }

        return {
            value: new MergeQuery({
                withClause,
                target,
                source,
                onCondition,
                whenClauses: whenResult.clauses
            }),
            newIndex: whenResult.newIndex
        };
    }

    private static parseWhenClauses(lexemes: Lexeme[], index: number): { clauses: MergeWhenClause[]; newIndex: number } {
        const clauses: MergeWhenClause[] = [];
        let idx = index;

        // Iterate until no further WHEN keyword is found.
        while (this.getLowerValue(lexemes[idx]) === "when") {
            idx++;

            // Determine the match type (matched, not matched, not matched by ...)
            const { matchType, newIndex: matchIndex } = this.parseMatchType(lexemes, idx);
            idx = matchIndex;

            // Parse optional AND condition that narrows the clause applicability.
            let additionalCondition: ValueComponent | null = null;
            if (this.getLowerValue(lexemes[idx]) === "and") {
                idx++;
                const conditionResult = ValueParser.parseFromLexeme(lexemes, idx);
                additionalCondition = conditionResult.value;
                idx = conditionResult.newIndex;
            }

            // Expect THEN before capturing the action body.
            if (this.getLowerValue(lexemes[idx]) !== "then") {
                const actual = lexemes[idx]?.value ?? "end of input";
                throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected 'THEN' but found '${actual}'.`);
            }
            idx++;

            // Dispatch to clause-specific action parser.
            const actionResult = this.parseAction(lexemes, idx);
            idx = actionResult.newIndex;
            clauses.push(new MergeWhenClause(matchType, actionResult.action, additionalCondition));
        }

        return { clauses, newIndex: idx };
    }

    private static parseMatchType(lexemes: Lexeme[], index: number): { matchType: MergeMatchType; newIndex: number } {
        let idx = index;

        const value = this.getLowerValue(lexemes[idx]);

        // Handle WHEN MATCHED scenario directly.
        if (value === "matched") {
            idx++;
            return { matchType: "matched", newIndex: idx };
        }

        // Handle the different NOT MATCHED variants (tokenized as atomic commands).
        if (value === "not matched") {
            idx++;
            let matchType: MergeMatchType = "not_matched";

            return { matchType, newIndex: idx };
        }

        if (value === "not matched by source") {
            idx++;
            return { matchType: "not_matched_by_source", newIndex: idx };
        }

        if (value === "not matched by target") {
            idx++;
            return { matchType: "not_matched_by_target", newIndex: idx };
        }

        const actual = lexemes[idx]?.value ?? "end of input";
        throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected 'MATCHED' or 'NOT MATCHED' but found '${actual}'.`);
    }

    private static parseAction(lexemes: Lexeme[], index: number): { action: MergeUpdateAction | MergeDeleteAction | MergeInsertAction | MergeDoNothingAction; newIndex: number } {
        let idx = index;
        const token = lexemes[idx];

        if (!token) {
            throw new Error("[MergeQueryParser] Unexpected end of input while parsing WHEN clause action.");
        }

        const tokenValue = token.value.toLowerCase();

        // Handle UPDATE branches (accepting 'update' or 'update set').
        if (tokenValue === "update" || tokenValue === "update set") {
            const expectSetKeyword = tokenValue === "update";
            idx++;
            const setResult = this.parseSetClause(lexemes, idx, expectSetKeyword);
            idx = setResult.newIndex;

            // Allow optional WHERE predicate to further limit updated rows.
            let whereClause: WhereClause | null = null;
            if (lexemes[idx]?.value === "where") {
                const whereResult = WhereClauseParser.parseFromLexeme(lexemes, idx);
                whereClause = whereResult.value;
                idx = whereResult.newIndex;
            }

            return {
                action: new MergeUpdateAction(setResult.setClause, whereClause),
                newIndex: idx
            };
        }

        // Handle DELETE (optional WHERE clause mirrors UPDATE behavior).
        if (tokenValue === "delete") {
            idx++;
            let whereClause: WhereClause | null = null;
            if (this.getLowerValue(lexemes[idx]) === "where") {
                const whereResult = WhereClauseParser.parseFromLexeme(lexemes, idx);
                whereClause = whereResult.value;
                idx = whereResult.newIndex;
            }

            return {
                action: new MergeDeleteAction(whereClause),
                newIndex: idx
            };
        }

        // Interpret DO NOTHING keyword sequence.
        if (tokenValue === "do nothing") {
            idx++;
            return { action: new MergeDoNothingAction(), newIndex: idx };
        }

        if (tokenValue === "insert default values") {
            idx++;
            let columns: IdentifierString[] | null = null;
            if (lexemes[idx]?.type === TokenType.OpenParen) {
                idx++;
                columns = [];
                while (idx < lexemes.length && (lexemes[idx].type & TokenType.Identifier)) {
                    columns.push(new IdentifierString(lexemes[idx].value));
                    idx++;
                    if (lexemes[idx]?.type === TokenType.Comma) {
                        idx++;
                        continue;
                    }
                    break;
                }
                if (lexemes[idx]?.type !== TokenType.CloseParen) {
                    const actual = lexemes[idx]?.value ?? "end of input";
                    throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected ')' after column list but found '${actual}'.`);
                }
                idx++;
                if (columns.length === 0) {
                    columns = [];
                }
            }
            return {
                action: new MergeInsertAction({
                    columns,
                    defaultValues: true
                }),
                newIndex: idx
            };
        }

        // Parse INSERT clauses including column projection and VALUES/default values.
        if (tokenValue === "insert") {
            idx++;
            const insertResult = this.parseInsertAction(lexemes, idx);
            return insertResult;
        }

        const actual = token.value;
        throw new Error(`[MergeQueryParser] Unsupported action '${actual}'. Only UPDATE, DELETE, INSERT, and DO NOTHING are supported within MERGE WHEN clauses.`);
    }

    private static parseSetClause(lexemes: Lexeme[], index: number, expectSetKeyword: boolean): { setClause: SetClause; newIndex: number } {
        let idx = index;

        // Optional SET keyword appears when MERGE uses 'UPDATE SET'.
        if (expectSetKeyword) {
            if (this.getLowerValue(lexemes[idx]) !== "set") {
                const actual = lexemes[idx]?.value ?? "end of input";
                throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected 'SET' but found '${actual}'.`);
            }
            idx++;
        } else if (this.getLowerValue(lexemes[idx]) === "set") {
            // Some dialects treat UPDATE SET as split tokens; absorb trailing SET if present.
            idx++;
        }

        const items: SetClauseItem[] = [];

        // Parse comma-separated column assignments.
        while (idx < lexemes.length) {
            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            idx = newIndex;

            if (lexemes[idx]?.type !== TokenType.Operator || lexemes[idx].value !== "=") {
                const actual = lexemes[idx]?.value ?? "end of input";
                throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected '=' in SET clause but found '${actual}'.`);
            }
            idx++;

            const valueResult = ValueParser.parseFromLexeme(lexemes, idx);
            items.push(new SetClauseItem({ namespaces, column: name }, valueResult.value));
            idx = valueResult.newIndex;

            if (lexemes[idx]?.type === TokenType.Comma) {
                idx++;
                continue;
            }
            break;
        }

        if (items.length === 0) {
            throw new Error("[MergeQueryParser] SET clause must contain at least one column assignment.");
        }

        return { setClause: new SetClause(items), newIndex: idx };
    }

    private static parseInsertAction(lexemes: Lexeme[], index: number): { action: MergeInsertAction; newIndex: number } {
        let idx = index;

        // Optional column projection enclosed in parentheses.
        let columns: IdentifierString[] | null = null;
        if (lexemes[idx]?.type === TokenType.OpenParen) {
            idx++;
            columns = [];
            while (idx < lexemes.length && (lexemes[idx].type & TokenType.Identifier)) {
                columns.push(new IdentifierString(lexemes[idx].value));
                idx++;
                if (lexemes[idx]?.type === TokenType.Comma) {
                    idx++;
                    continue;
                }
                break;
            }
            if (lexemes[idx]?.type !== TokenType.CloseParen) {
                const actual = lexemes[idx]?.value ?? "end of input";
                throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected ')' after column list but found '${actual}'.`);
            }
            idx++;
            if (columns.length === 0) {
                columns = [];
            }
        }

        // Parse VALUES (...) payload referencing source columns.
        if (this.getLowerValue(lexemes[idx]) === "values") {
            idx++;
            const valuesResult = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            idx = valuesResult.newIndex;

            if (!(valuesResult.value instanceof ValueList)) {
                throw new Error("[MergeQueryParser] Unexpected VALUES payload. Expected a parenthesized value list.");
            }

            return {
                action: new MergeInsertAction({
                    columns,
                    values: valuesResult.value
                }),
                newIndex: idx
            };
        }

        const actual = lexemes[idx]?.value ?? "end of input";
        throw new Error(`[MergeQueryParser] Unsupported INSERT payload '${actual}'. Use VALUES (...) or DEFAULT VALUES.`);
    }

    private static getLowerValue(lexeme?: Lexeme): string | null {
        if (!lexeme) {
            return null;
        }
        return typeof lexeme.value === "string" ? lexeme.value.toLowerCase() : null;
    }
}
