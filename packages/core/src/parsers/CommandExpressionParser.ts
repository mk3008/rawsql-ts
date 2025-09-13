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
            result.positionedComments = [{
                position: 'before' as const,
                comments: caseKeywordComments
            }];
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
            result.positionedComments = [{
                position: 'before' as const,
                comments: caseWhenKeywordComments
            }];
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
        let elseValue = null;

        // Process WHEN clauses
        while (idx < lexemes.length && this.isCommandWithValue(lexemes[idx], "when")) {
            idx++;
            const whenResult = this.parseCaseConditionValuePair(lexemes, idx);
            idx = whenResult.newIndex;
            whenThenList.push(whenResult.value);
        }

        // Process ELSE
        let elseKeywordComments: string[] | null = null;
        let elseKeywordPositionedComments: any = null;
        if (idx < lexemes.length && this.isCommandWithValue(lexemes[idx], "else")) {
            // Capture ELSE keyword comments before consuming
            elseKeywordComments = lexemes[idx].comments;
            elseKeywordPositionedComments = lexemes[idx].positionedComments;
            idx++;
            const elseResult = ValueParser.parseFromLexeme(lexemes, idx);
            elseValue = elseResult.value;
            idx = elseResult.newIndex;
        }

        // Process END
        let endKeywordComments: string[] | null = null;
        let endKeywordPositionedComments: any = null;
        if (idx < lexemes.length && this.isCommandWithValue(lexemes[idx], "end")) {
            // Capture END keyword comments before consuming
            endKeywordComments = lexemes[idx].comments;
            endKeywordPositionedComments = lexemes[idx].positionedComments;
            idx++;
        } else {
            throw new Error(`The CASE expression requires 'end' keyword at the end (index ${idx})`);
        }

        if (whenThenList.length === 0) {
            throw new Error(`The CASE expression requires at least one WHEN clause (index ${idx})`);
        }

        // Create SwitchCaseArgument
        const switchCaseArg = new SwitchCaseArgument(whenThenList, elseValue);
        
        // Store ELSE and END keyword comments 
        // For now, we'll combine them and store on the SwitchCaseArgument
        const allKeywordComments: string[] = [];
        if (elseKeywordComments && elseKeywordComments.length > 0) {
            allKeywordComments.push(...elseKeywordComments);
        }
        if (endKeywordComments && endKeywordComments.length > 0) {
            allKeywordComments.push(...endKeywordComments);
        }
        // Store positioned comments (combine ELSE and END) - unified spec: positioned comments only
        const allPositionedComments: any[] = [];
        if (elseKeywordPositionedComments && elseKeywordPositionedComments.length > 0) {
            allPositionedComments.push(...elseKeywordPositionedComments);
        }
        if (endKeywordPositionedComments && endKeywordPositionedComments.length > 0) {
            allPositionedComments.push(...endKeywordPositionedComments);
        }
        
        // Convert legacy comments to positioned comments if no positioned comments exist
        if (allPositionedComments.length === 0 && allKeywordComments.length > 0) {
            allPositionedComments.push({
                position: 'after' as const,
                comments: allKeywordComments
            });
        }
        
        if (allPositionedComments.length > 0) {
            switchCaseArg.positionedComments = allPositionedComments;
        }

        return { value: switchCaseArg, newIndex: idx };
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
            keyValuePair.positionedComments = [{
                position: 'after' as const,
                comments: thenKeywordComments
            }];
        }

        return { value: keyValuePair, newIndex: idx };
    }
}