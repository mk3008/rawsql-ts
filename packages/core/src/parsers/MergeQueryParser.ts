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
import { extractLexemeComments } from "./utils/LexemeCommentUtils";
import { SqlComponent } from "../models/SqlComponent";

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
        const mergeKeywordLexeme = lexemes[idx];
        const mergeKeywordComments = extractLexemeComments(mergeKeywordLexeme);
        if (mergeKeywordLexeme?.value !== "merge into") {
            const actual = lexemes[idx]?.value ?? "end of input";
            throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected 'MERGE INTO' but found '${actual}'.`);
        }
        idx++;

        // Parse target source expression (table or alias assignment).
        const targetResult = SourceExpressionParser.parseFromLexeme(lexemes, idx);
        const target = targetResult.value;
        idx = targetResult.newIndex;

        // Attach inline comments following MERGE INTO to the target source.
        this.addUniquePositionedComments(target.datasource, "before", mergeKeywordComments.after);

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

        const mergeQuery = new MergeQuery({
            withClause,
            target,
            source,
            onCondition,
            whenClauses: whenResult.clauses
        });

        // Preserve leading comments that precede the MERGE keyword.
        this.addUniquePositionedComments(mergeQuery, "before", mergeKeywordComments.before);

        return {
            value: mergeQuery,
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
            const thenLexeme = lexemes[idx];
            if (this.getLowerValue(thenLexeme) !== "then") {
                const actual = thenLexeme?.value ?? "end of input";
                throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected 'THEN' but found '${actual}'.`);
            }
            const thenComments = extractLexemeComments(thenLexeme);
            const commentsBeforeThen: string[] = [];
            const precedingLexeme = lexemes[idx - 1];
            if (precedingLexeme) {
                const precedingComments = extractLexemeComments(precedingLexeme);
                this.mergeUnique(commentsBeforeThen, precedingComments.after);
            }
            this.mergeUnique(commentsBeforeThen, thenComments.before);
            idx++;

            // Dispatch to clause-specific action parser with comments that follow THEN.
            const actionResult = this.parseAction(lexemes, idx, thenComments.after ?? []);
            idx = actionResult.newIndex;

            const whenClause = new MergeWhenClause(matchType, actionResult.action, additionalCondition);
            whenClause.addThenLeadingComments(commentsBeforeThen);
            clauses.push(whenClause);
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

    private static parseAction(lexemes: Lexeme[], index: number, leadingComments: string[] = []): { action: MergeUpdateAction | MergeDeleteAction | MergeInsertAction | MergeDoNothingAction; newIndex: number } {
        let idx = index;
        const token = lexemes[idx];

        if (!token) {
            throw new Error("[MergeQueryParser] Unexpected end of input while parsing WHEN clause action.");
        }

        const tokenValue = token.value.toLowerCase();
        const tokenComments = extractLexemeComments(token);
        const actionLeadingComments: string[] = [];
        this.mergeUnique(actionLeadingComments, leadingComments);
        this.mergeUnique(actionLeadingComments, tokenComments.before);

        // Handle UPDATE branches (accepting 'update' or 'update set').
        if (tokenValue === "update" || tokenValue === "update set") {
            const expectSetKeyword = tokenValue === "update";
            idx++;
            const pendingSetClauseComments = tokenComments.after;
            const setResult = this.parseSetClause(lexemes, idx, expectSetKeyword, pendingSetClauseComments);
            idx = setResult.newIndex;

            // Allow optional WHERE predicate to further limit updated rows.
            let whereClause: WhereClause | null = null;
            if (lexemes[idx]?.value === "where") {
                const whereResult = WhereClauseParser.parseFromLexeme(lexemes, idx);
                whereClause = whereResult.value;
                idx = whereResult.newIndex;
            }

            const action = new MergeUpdateAction(setResult.setClause, whereClause);
            this.addUniquePositionedComments(action, "before", actionLeadingComments);

            return {
                action,
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

            const action = new MergeDeleteAction(whereClause);
            this.addUniquePositionedComments(action, "before", actionLeadingComments);
            this.addUniquePositionedComments(action, "after", tokenComments.after);

            return {
                action,
                newIndex: idx
            };
        }

        // Interpret DO NOTHING keyword sequence.
        if (tokenValue === "do nothing") {
            idx++;
            const action = new MergeDoNothingAction();
            this.addUniquePositionedComments(action, "before", actionLeadingComments);
            this.addUniquePositionedComments(action, "after", tokenComments.after);
            return { action, newIndex: idx };
        }

        if (tokenValue === "insert default values") {
            idx++;
            const columnResult = this.parseInsertColumnProjection(lexemes, idx, tokenComments.after);
            idx = columnResult.newIndex;

            const action = new MergeInsertAction({
                columns: columnResult.columns,
                defaultValues: true
            });
            this.addUniquePositionedComments(action, "before", actionLeadingComments);
            this.addUniquePositionedComments(action, "after", columnResult.trailingComments);
            return {
                action,
                newIndex: idx
            };
        }

        // Parse INSERT clauses including column projection and VALUES/default values.
        if (tokenValue === "insert") {
            idx++;
            const insertResult = this.parseInsertAction(lexemes, idx, {
                pendingCommentsAfterInsert: tokenComments.after
            });
            this.addUniquePositionedComments(insertResult.action, "before", actionLeadingComments);
            return insertResult;
        }

        const actual = token.value;
        throw new Error(`[MergeQueryParser] Unsupported action '${actual}'. Only UPDATE, DELETE, INSERT, and DO NOTHING are supported within MERGE WHEN clauses.`);
    }

    private static parseSetClause(lexemes: Lexeme[], index: number, expectSetKeyword: boolean, pendingCommentsAfterUpdate: string[] = []): { setClause: SetClause; newIndex: number } {
        let idx = index;

        // Capture comments that accompany the SET keyword so they can be reapplied later.
        let setKeywordComments = extractLexemeComments(lexemes[idx]);
        if (expectSetKeyword) {
            if (this.getLowerValue(lexemes[idx]) !== "set") {
                const actual = lexemes[idx]?.value ?? "end of input";
                throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected 'SET' but found '${actual}'.`);
            }
            idx++;
        } else if (this.getLowerValue(lexemes[idx]) === "set") {
            setKeywordComments = extractLexemeComments(lexemes[idx]);
            idx++;
        } else {
            setKeywordComments = { before: [], after: [] };
        }

        const items: SetClauseItem[] = [];
        let pendingBeforeForNext: string[] = [];

        // Comments trailing UPDATE or SET precede the first assignment.
        this.mergeUnique(pendingBeforeForNext, pendingCommentsAfterUpdate);
        this.mergeUnique(pendingBeforeForNext, setKeywordComments.after);

        // Parse comma-separated column assignments.
        while (idx < lexemes.length) {
            const currentLexeme = lexemes[idx];

            if (!currentLexeme) {
                break;
            }

            // Stop when we encounter tokens that belong to the next clause (e.g., WHERE or WHEN).
            if (this.isSetClauseTerminator(currentLexeme)) {
                break;
            }

            if (!(currentLexeme.type & (TokenType.Identifier | TokenType.Function | TokenType.Type | TokenType.OpenBracket))) {
                break;
            }

            const columnComments = extractLexemeComments(currentLexeme);
            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            idx = newIndex;

            if (lexemes[idx]?.type !== TokenType.Operator || lexemes[idx].value !== "=") {
                const actual = lexemes[idx]?.value ?? "end of input";
                throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected '=' in SET clause but found '${actual}'.`);
            }

            const equalsLexeme = lexemes[idx];
            const equalsComments = extractLexemeComments(equalsLexeme);
            idx++;

            const valueResult = ValueParser.parseFromLexeme(lexemes, idx);
            idx = valueResult.newIndex;

            const setItem = new SetClauseItem({ namespaces, column: name }, valueResult.value);

            // Move buffered comments to the column identifier before processing the assignment.
            const beforeComments: string[] = [];
            this.mergeUnique(beforeComments, pendingBeforeForNext);
            this.mergeUnique(beforeComments, columnComments.before);
            this.addUniquePositionedComments(name, "before", beforeComments);
            pendingBeforeForNext = [];

            // Keep trailing identifier comments attached to the column token.
            this.addUniquePositionedComments(name, "after", columnComments.after);

            // Preserve comments embedded around the '=' operator.
            this.addUniquePositionedComments(setItem, "after", equalsComments.before);
            this.addUniquePositionedComments(valueResult.value, "before", equalsComments.after);

            items.push(setItem);

            if (lexemes[idx]?.type === TokenType.Comma) {
                const commaLexeme = lexemes[idx];
                const commaComments = extractLexemeComments(commaLexeme);
                idx++;

                // Comments before the comma belong to the current assignment.
                this.addUniquePositionedComments(setItem, "after", commaComments.before);

                // Comments after the comma should precede the following assignment.
                pendingBeforeForNext = [];
                this.mergeUnique(pendingBeforeForNext, commaComments.after);
                continue;
            }
            break;
        }

        if (pendingBeforeForNext.length > 0 && items.length > 0) {
            this.addUniquePositionedComments(items[items.length - 1], "after", pendingBeforeForNext);
        }

        if (items.length === 0) {
            throw new Error("[MergeQueryParser] SET clause must contain at least one column assignment.");
        }

        const setClause = new SetClause(items);

        // Any comments before SET belong in front of the entire clause.
        this.addUniquePositionedComments(setClause, "before", setKeywordComments.before);

        return { setClause, newIndex: idx };
    }

    private static parseInsertAction(lexemes: Lexeme[], index: number, options?: { pendingCommentsAfterInsert?: string[] }): { action: MergeInsertAction; newIndex: number } {
        let idx = index;
        const pendingAfterInsert = options?.pendingCommentsAfterInsert ?? [];

        // Parse column projection and capture any comments that should precede VALUES.
        const columnResult = this.parseInsertColumnProjection(lexemes, idx, pendingAfterInsert);
        let columns = columnResult.columns;
        idx = columnResult.newIndex;
        let pendingBeforeValues = columnResult.trailingComments;

        // Parse VALUES (...) payload referencing source columns.
        if (this.getLowerValue(lexemes[idx]) === "values") {
            const valuesLexeme = lexemes[idx];
            const valuesComments = extractLexemeComments(valuesLexeme);
            idx++;

            // Comments carried forward should appear before the tuple list.
            const beforeValuesComments: string[] = [];
            this.mergeUnique(beforeValuesComments, pendingBeforeValues);
            this.mergeUnique(beforeValuesComments, valuesComments.before);

            const valuesResult = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            idx = valuesResult.newIndex;

            if (!(valuesResult.value instanceof ValueList)) {
                throw new Error("[MergeQueryParser] Unexpected VALUES payload. Expected a parenthesized value list.");
            }

            const valueList = valuesResult.value;
            const closingParenComments = extractLexemeComments(lexemes[idx - 1]);
            this.addUniquePositionedComments(valueList, "after", closingParenComments.after);
            this.addUniquePositionedComments(valueList, "after", valuesComments.after);

            const action = new MergeInsertAction({
                columns,
                values: valueList
            });
            action.addValuesLeadingComments(beforeValuesComments);

            return {
                action,
                newIndex: idx
            };
        }

        const actual = lexemes[idx]?.value ?? "end of input";
        throw new Error(`[MergeQueryParser] Unsupported INSERT payload '${actual}'. Use VALUES (...) or DEFAULT VALUES.`);
    }

    private static parseInsertColumnProjection(
        lexemes: Lexeme[],
        index: number,
        pendingBeforeFirstColumn: string[]
    ): { columns: IdentifierString[] | null; newIndex: number; trailingComments: string[] } {
        let idx = index;

        // Without parentheses there is no column projection, so pass comments forward to VALUES.
        if (lexemes[idx]?.type !== TokenType.OpenParen) {
            return {
                columns: null,
                newIndex: idx,
                trailingComments: [...pendingBeforeFirstColumn]
            };
        }

        const openParenLexeme = lexemes[idx];
        const parenComments = extractLexemeComments(openParenLexeme);
        idx++;

        const columns: IdentifierString[] = [];
        let pendingBeforeForNext: string[] = [];

        // Seed the first identifier with comments that trail INSERT or the opening parenthesis.
        this.mergeUnique(pendingBeforeForNext, pendingBeforeFirstColumn);
        this.mergeUnique(pendingBeforeForNext, parenComments.before);
        this.mergeUnique(pendingBeforeForNext, parenComments.after);

        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Identifier)) {
            const columnLexeme = lexemes[idx];
            const columnComments = extractLexemeComments(columnLexeme);
            const column = new IdentifierString(columnLexeme.value);

            // Move buffered comments so they precede the current identifier.
            const beforeComments: string[] = [];
            this.mergeUnique(beforeComments, pendingBeforeForNext);
            this.mergeUnique(beforeComments, columnComments.before);
            this.addUniquePositionedComments(column, "before", beforeComments);
            pendingBeforeForNext = [];

            // Preserve comments that trail the identifier itself.
            this.addUniquePositionedComments(column, "after", columnComments.after);

            columns.push(column);
            idx++;

            if (lexemes[idx]?.type === TokenType.Comma) {
                const commaLexeme = lexemes[idx];
                const commaComments = extractLexemeComments(commaLexeme);
                idx++;

                // Attach comma-leading comments to the current column.
                this.addUniquePositionedComments(column, "after", commaComments.before);

                // Comments after the comma prepare the next identifier.
                pendingBeforeForNext = [];
                this.mergeUnique(pendingBeforeForNext, commaComments.after);
                continue;
            }

            break;
        }

        if (pendingBeforeForNext.length > 0 && columns.length > 0) {
            this.addUniquePositionedComments(columns[columns.length - 1], "after", pendingBeforeForNext);
            pendingBeforeForNext = [];
        }

        if (lexemes[idx]?.type !== TokenType.CloseParen) {
            const actual = lexemes[idx]?.value ?? "end of input";
            throw new Error(`[MergeQueryParser] Syntax error at position ${idx}: expected ')' after column list but found '${actual}'.`);
        }

        const closeParenLexeme = lexemes[idx];
        const closeParenComments = extractLexemeComments(closeParenLexeme);
        idx++;

        if (closeParenComments.before.length > 0 && columns.length > 0) {
            this.addUniquePositionedComments(columns[columns.length - 1], "after", closeParenComments.before);
        }

        const trailingComments: string[] = [];
        this.mergeUnique(trailingComments, closeParenComments.after);
        this.mergeUnique(trailingComments, pendingBeforeForNext);

        return {
            columns: columns.length > 0 ? columns : [],
            newIndex: idx,
            trailingComments
        };
    }

    private static isSetClauseTerminator(lexeme?: Lexeme): boolean {
        if (!lexeme) {
            return false;
        }

        // Normalize to lowercase so we can compare mixed-case keywords safely.
        const value = this.getLowerValue(lexeme);
        if (!value) {
            return false;
        }

        return value === "where" || value === "from" || value === "returning" || value === "when";
    }

    private static mergeUnique(target: string[], source: string[] | undefined): void {
        if (!source || source.length === 0) {
            return;
        }
        for (const comment of source) {
            if (!target.includes(comment)) {
                target.push(comment);
            }
        }
    }

    private static addUniquePositionedComments(component: SqlComponent | null | undefined, position: "before" | "after", comments: string[] | undefined): void {
        if (!component || !comments || comments.length === 0) {
            return;
        }
        const existing = component.getPositionedComments(position);
        const newOnes = comments.filter(comment => !existing.includes(comment));
        if (newOnes.length > 0) {
            component.addPositionedComments(position, newOnes);
        }
    }

    private static getLowerValue(lexeme?: Lexeme): string | null {
        if (!lexeme) {
            return null;
        }
        return typeof lexeme.value === "string" ? lexeme.value.toLowerCase() : null;
    }
}
