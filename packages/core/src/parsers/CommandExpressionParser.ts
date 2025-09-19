import { Lexeme, TokenType } from "../models/Lexeme";
import { ArrayExpression, CaseExpression, CaseKeyValuePair, SwitchCaseArgument, UnaryExpression, ValueComponent } from "../models/ValueComponent";
import { ValueParser } from "./ValueParser";

export class CommandExpressionParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        const current = lexemes[idx];
        if (current.value === "case") {
            // Capture CASE keyword comments before consuming
            const caseKeywordComments = current.comments;
            const caseKeywordPositionedComments = current.positionedComments;
            idx++;
            return this.parseCaseExpression(lexemes, idx, caseKeywordComments, caseKeywordPositionedComments);
        } else if (current.value === "case when") {
            // Capture CASE WHEN keyword comments before consuming
            const caseWhenKeywordComments = current.comments;
            const caseWhenKeywordPositionedComments = current.positionedComments;
            idx++;
            return this.parseCaseWhenExpression(lexemes, idx, caseWhenKeywordComments, caseWhenKeywordPositionedComments);
        }

        return this.parseModifierUnaryExpression(lexemes, idx);
    }

    private static parseModifierUnaryExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        // Check for modifier unary expression
        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Command)) {
            const command = lexemes[idx].value;
            idx++;
            const result = ValueParser.parseFromLexeme(lexemes, idx);
            return { value: new UnaryExpression(command!, result.value), newIndex: result.newIndex };
        }
        throw new Error(`Invalid modifier unary expression at index ${idx}, Lexeme: ${lexemes[idx].value}`);
    }

    private static parseCaseExpression(lexemes: Lexeme[], index: number, caseKeywordComments?: string[] | null, caseKeywordPositionedComments?: any): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        const condition = ValueParser.parseFromLexeme(lexemes, idx);
        idx = condition.newIndex;

        const switchCaseResult = this.parseSwitchCaseArgument(lexemes, idx, []);
        idx = switchCaseResult.newIndex;

        // Create CASE expression
        const result = new CaseExpression(condition.value, switchCaseResult.value);
        
        // Assign CASE keyword comments to the CaseExpression (positioned comments only for unified spec)
        if (caseKeywordPositionedComments && caseKeywordPositionedComments.length > 0) {
            result.positionedComments = caseKeywordPositionedComments;
        } else if (caseKeywordComments && caseKeywordComments.length > 0) {
            // Convert legacy comments to positioned comments for unified spec
            result.positionedComments = [CommandExpressionParser.convertLegacyToPositioned(caseKeywordComments, 'before')];
        }
        
        return { value: result, newIndex: idx };
    }

    private static parseCaseWhenExpression(lexemes: Lexeme[], index: number, caseWhenKeywordComments?: string[] | null, caseWhenKeywordPositionedComments?: any): { value: ValueComponent; newIndex: number; } {
        let idx = index;

        // Parse the first WHEN clause
        const casewhenResult = this.parseCaseConditionValuePair(lexemes, idx);
        idx = casewhenResult.newIndex;

        // Add the initial WHEN-THEN pair to the list
        const caseWhenList = [casewhenResult.value];

        // Process remaining WHEN-ELSE-END parts
        const switchCaseResult = this.parseSwitchCaseArgument(lexemes, idx, caseWhenList);
        idx = switchCaseResult.newIndex;

        // Create CASE expression with condition null (uses WHEN conditions instead of a simple CASE)
        const result = new CaseExpression(null, switchCaseResult.value);
        
        // Assign CASE WHEN keyword comments to the CaseExpression (positioned comments only for unified spec)
        if (caseWhenKeywordPositionedComments && caseWhenKeywordPositionedComments.length > 0) {
            result.positionedComments = caseWhenKeywordPositionedComments;
        } else if (caseWhenKeywordComments && caseWhenKeywordComments.length > 0) {
            // Convert legacy comments to positioned comments for unified spec
            result.positionedComments = [CommandExpressionParser.convertLegacyToPositioned(caseWhenKeywordComments, 'before')];
        }
        
        return { value: result, newIndex: idx };
    }

    // parseSwitchCaseArgument method processes the WHEN, ELSE, and END clauses of a CASE expression.
    private static parseSwitchCaseArgument(
        lexemes: Lexeme[],
        index: number,
        initialWhenThenList: CaseKeyValuePair[]
    ): { value: SwitchCaseArgument; newIndex: number; } {
        let idx = index;
        const whenThenList = [...initialWhenThenList];

        // Parse all WHEN clauses
        idx = this.parseAdditionalWhenClauses(lexemes, idx, whenThenList);

        // Parse optional ELSE clause
        const { elseValue, elseComments, newIndex: elseIndex } = this.parseElseClause(lexemes, idx);
        idx = elseIndex;

        // Parse required END clause
        const { endComments, newIndex: endIndex } = this.parseEndClause(lexemes, idx);
        idx = endIndex;

        if (whenThenList.length === 0) {
            throw new Error(`The CASE expression requires at least one WHEN clause (index ${idx})`);
        }

        // Create SwitchCaseArgument and apply comments directly
        const switchCaseArg = new SwitchCaseArgument(whenThenList, elseValue);
        this.applySwitchCaseComments(switchCaseArg, elseComments, endComments);

        return { value: switchCaseArg, newIndex: idx };
    }

    // Parse additional WHEN clauses
    private static parseAdditionalWhenClauses(lexemes: Lexeme[], index: number, whenThenList: CaseKeyValuePair[]): number {
        let idx = index;
        while (idx < lexemes.length && this.isCommandWithValue(lexemes[idx], "when")) {
            idx++;
            const whenResult = this.parseCaseConditionValuePair(lexemes, idx);
            idx = whenResult.newIndex;
            whenThenList.push(whenResult.value);
        }
        return idx;
    }

    // Parse optional ELSE clause
    private static parseElseClause(lexemes: Lexeme[], index: number): { elseValue: any; elseComments: any; newIndex: number } {
        let elseValue = null;
        let elseComments = null;
        let idx = index;

        if (idx < lexemes.length && this.isCommandWithValue(lexemes[idx], "else")) {
            // Extract comments from ELSE keyword before consuming
            elseComments = this.extractKeywordComments(lexemes[idx]);
            idx++;
            const elseResult = ValueParser.parseFromLexeme(lexemes, idx);
            elseValue = elseResult.value;
            idx = elseResult.newIndex;
        }

        return { elseValue, elseComments, newIndex: idx };
    }

    // Parse required END clause
    private static parseEndClause(lexemes: Lexeme[], index: number): { endComments: any; newIndex: number } {
        let idx = index;
        let endComments = null;

        if (idx < lexemes.length && this.isCommandWithValue(lexemes[idx], "end")) {
            // Extract comments from END keyword before consuming
            endComments = this.extractKeywordComments(lexemes[idx]);
            idx++;
        } else {
            throw new Error(`The CASE expression requires 'end' keyword at the end (index ${idx})`);
        }

        return { endComments, newIndex: idx };
    }

    // Extract comments from a keyword token
    private static extractKeywordComments(token: Lexeme): { legacy: string[] | null; positioned: any } {
        return {
            legacy: token.comments,
            positioned: token.positionedComments
        };
    }

    // Apply comments to SwitchCaseArgument directly (no collection then assignment)
    private static applySwitchCaseComments(switchCaseArg: SwitchCaseArgument, elseComments: any, endComments: any): void {
        const allPositionedComments: any[] = [];
        const allLegacyComments: string[] = [];

        // Process ELSE comments directly
        if (elseComments?.positioned && elseComments.positioned.length > 0) {
            allPositionedComments.push(...elseComments.positioned);
        }
        if (elseComments?.legacy && elseComments.legacy.length > 0) {
            allLegacyComments.push(...elseComments.legacy);
        }

        // Process END comments directly
        if (endComments?.positioned && endComments.positioned.length > 0) {
            allPositionedComments.push(...endComments.positioned);
        }
        if (endComments?.legacy && endComments.legacy.length > 0) {
            allLegacyComments.push(...endComments.legacy);
        }

        // Apply positioned comments directly, or convert legacy comments
        if (allPositionedComments.length > 0) {
            switchCaseArg.positionedComments = allPositionedComments;
        } else if (allLegacyComments.length > 0) {
            switchCaseArg.positionedComments = [CommandExpressionParser.convertLegacyToPositioned(allLegacyComments, 'after')];
        }
    }

    // Helper method: Check if a lexeme is a Command token with the specified value
    private static isCommandWithValue(lexeme: Lexeme, value: string): boolean {
        return ((lexeme.type & TokenType.Command) !== 0) && lexeme.value === value;
    }

    private static parseCaseConditionValuePair(lexemes: Lexeme[], index: number): { value: CaseKeyValuePair; newIndex: number; } {
        let idx = index;
        const condition = ValueParser.parseFromLexeme(lexemes, idx);
        idx = condition.newIndex;

        // Check for the existence of the THEN keyword
        if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.Command) || lexemes[idx].value !== "then") {
            throw new Error(`Expected 'then' after WHEN condition at index ${idx}`);
        }
        // Capture THEN keyword comments before consuming
        const thenKeywordComments = lexemes[idx].comments;
        const thenKeywordPositionedComments = lexemes[idx].positionedComments;
        idx++; // Skip the THEN keyword

        // Parse the value after THEN
        const value = ValueParser.parseFromLexeme(lexemes, idx);
        idx = value.newIndex;

        const keyValuePair = new CaseKeyValuePair(condition.value, value.value);
        // Store THEN keyword comments on the CaseKeyValuePair
        // Store THEN keyword comments - unified spec: positioned comments only
        if (thenKeywordPositionedComments && thenKeywordPositionedComments.length > 0) {
            keyValuePair.positionedComments = thenKeywordPositionedComments;
        } else if (thenKeywordComments && thenKeywordComments.length > 0) {
            // Convert legacy comments to positioned comments for unified spec
            keyValuePair.positionedComments = [CommandExpressionParser.convertLegacyToPositioned(thenKeywordComments, 'after')];
        }

        return { value: keyValuePair, newIndex: idx };
    }

    /**
     * Convert legacy comments to positioned comments format
     */
    private static convertLegacyToPositioned(
        legacyComments: string[],
        position: 'before' | 'after' = 'before'
    ): { position: 'before' | 'after', comments: string[] } {
        return {
            position,
            comments: legacyComments
        };
    }
}