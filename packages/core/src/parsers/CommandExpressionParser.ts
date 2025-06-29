import { Lexeme, TokenType } from "../models/Lexeme";
import { ArrayExpression, CaseExpression, CaseKeyValuePair, SwitchCaseArgument, UnaryExpression, ValueComponent } from "../models/ValueComponent";
import { ValueParser } from "./ValueParser";

export class CommandExpressionParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        const current = lexemes[idx];
        if (current.value === "case") {
            idx++;
            return this.parseCaseExpression(lexemes, idx);
        } else if (current.value === "case when") {
            idx++;
            return this.parseCaseWhenExpression(lexemes, idx);
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

    private static parseCaseExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        const condition = ValueParser.parseFromLexeme(lexemes, idx);
        idx = condition.newIndex;

        const switchCaseResult = this.parseSwitchCaseArgument(lexemes, idx, []);
        idx = switchCaseResult.newIndex;

        // Create CASE expression
        const result = new CaseExpression(condition.value, switchCaseResult.value);
        return { value: result, newIndex: idx };
    }

    private static parseCaseWhenExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number; } {
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
        if (idx < lexemes.length && this.isCommandWithValue(lexemes[idx], "else")) {
            idx++;
            const elseResult = ValueParser.parseFromLexeme(lexemes, idx);
            elseValue = elseResult.value;
            idx = elseResult.newIndex;
        }

        // Process END
        if (idx < lexemes.length && this.isCommandWithValue(lexemes[idx], "end")) {
            idx++;
        } else {
            throw new Error(`The CASE expression requires 'end' keyword at the end (index ${idx})`);
        }

        if (whenThenList.length === 0) {
            throw new Error(`The CASE expression requires at least one WHEN clause (index ${idx})`);
        }

        // Create SwitchCaseArgument
        const value = new SwitchCaseArgument(whenThenList, elseValue);
        return { value, newIndex: idx };
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
        idx++; // Skip the THEN keyword

        // Parse the value after THEN
        const value = ValueParser.parseFromLexeme(lexemes, idx);
        idx = value.newIndex;

        return { value: new CaseKeyValuePair(condition.value, value.value), newIndex: idx };
    }
}