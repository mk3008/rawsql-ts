import { Lexeme, TokenType } from "../models/Lexeme";
import { FunctionCall, ValueComponent, BinaryExpression, TypeValue, CastExpression, BetweenExpression } from "../models/ValueComponent";
import { OverExpressionParser } from "./OverExpressionParser";
import { ValueParser } from "./ValueParser";

export class FunctionExpressionParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        const current = lexemes[idx];

        if (current.value === "substring" || current.value === "overlay") {
            return this.parseKeywordFunction(lexemes, idx, [
                { key: "from", required: false },
                { key: "for", required: false }
            ]);
        } else if (current.value === "cast") {
            return this.parseKeywordFunction(lexemes, idx, [
                { key: "as", required: true }
            ]);
        } else if (current.value === "trim") {
            return this.parseKeywordFunction(lexemes, idx, [
                { key: "from", required: false }
            ]);
        }

        return this.parseFunctionCall(lexemes, idx);
    }

    public static tryParseBinaryExpression(lexemes: Lexeme[], index: number, left: ValueComponent, allowAndOperator: boolean = true): { value: ValueComponent; newIndex: number } | null {
        let idx = index;

        // If the next element is an operator, process it as a binary expression
        if (idx < lexemes.length && lexemes[idx].type === TokenType.Operator) {
            if (!allowAndOperator && lexemes[idx].value === "and") {
                // Handle special case for "and" operator
                return null;
            }

            const operator = lexemes[idx].value as string;
            idx++;

            // between
            if (operator === "between") {
                return this.parseBetweenExpression(lexemes, idx, left, false);
            } else if (operator === "not between") {
                return this.parseBetweenExpression(lexemes, idx, left, true);
            }

            // ::
            if (operator === "::") {
                const typeValue = this.parseTypeValue(lexemes, idx);
                idx = typeValue.newIndex;
                const exp = new CastExpression(left, typeValue.value);
                return { value: exp, newIndex: idx };
            }

            // Get the right-hand side value
            const rightResult = ValueParser.parseFromLexeme(lexemes, idx);
            idx = rightResult.newIndex;

            // Create binary expression
            const value = new BinaryExpression(left, operator, rightResult.value);
            return { value, newIndex: idx };
        }

        return null;
    }

    public static parseBetweenExpression(lexemes: Lexeme[], index: number, value: ValueComponent, negated: boolean): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        const lower = ValueParser.parseFromLexeme(lexemes, idx, false);
        idx = lower.newIndex;

        if (idx < lexemes.length && lexemes[idx].type === TokenType.Operator && lexemes[idx].value !== "and") {
            throw new Error(`Expected 'and' after 'between' at index ${idx}`);
        }
        idx++;

        const upper = ValueParser.parseFromLexeme(lexemes, idx);
        idx = upper.newIndex;
        const result = new BetweenExpression(value, lower.value, upper.value, negated);
        return { value: result, newIndex: idx };
    }

    private static parseFunctionCall(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Get function name
        const result = lexemes[idx];
        const functionName = result.value;
        idx++;

        if (idx < lexemes.length && lexemes[idx].type === TokenType.OpenParen) {
            // General argument parsing
            const arg = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            idx = arg.newIndex;

            if (idx < lexemes.length && lexemes[idx].value === "over") {
                const over = OverExpressionParser.parseFromLexeme(lexemes, idx);
                idx = over.newIndex;
                const value = new FunctionCall(functionName, arg.value, over.value);
                return { value, newIndex: idx };
            } else {
                const value = new FunctionCall(functionName, arg.value, null);
                return { value, newIndex: idx };
            }
        } else {
            throw new Error(`Expected opening parenthesis after function name '${functionName}' at index ${idx}`);
        }
    }

    private static parseKeywordFunction(
        lexemes: Lexeme[],
        index: number,
        keywords: { key: string, required: boolean }[]
    ): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        const functionName = lexemes[idx].value;
        idx++;

        if (idx < lexemes.length && lexemes[idx].type === TokenType.OpenParen) {
            idx++;

            const input = ValueParser.parseFromLexeme(lexemes, idx);
            let arg = input.value;
            idx = input.newIndex;

            // Delegate to the standard function parser if parsing by comma
            if (idx < lexemes.length && lexemes[idx].type === TokenType.Comma) {
                return this.parseFunctionCall(lexemes, index);
            }

            // Check keywords
            for (const { key, required } of keywords) {
                if (idx < lexemes.length && lexemes[idx].type === TokenType.Command && lexemes[idx].value === key) {
                    idx++;

                    if (idx < lexemes.length && (lexemes[idx].type === TokenType.Type || lexemes[idx].maybeType === true)) {
                        const typeValue = this.parseTypeValue(lexemes, idx);
                        arg = new BinaryExpression(arg, key, typeValue.value);
                        idx = typeValue.newIndex;
                    } else {
                        const right = ValueParser.parseFromLexeme(lexemes, idx);
                        arg = new BinaryExpression(arg, key, right.value);
                        idx = right.newIndex;
                    }

                } else if (required) {
                    throw new Error(`Keyword '${key}' is required at index ${idx}`);
                }
            }

            if (idx < lexemes.length && lexemes[idx].type === TokenType.CloseParen) {
                idx++;
                if (idx < lexemes.length && lexemes[idx].value === "over") {
                    idx++;
                    const over = OverExpressionParser.parseFromLexeme(lexemes, idx);
                    idx = over.newIndex;
                    const value = new FunctionCall(functionName, arg, over.value);
                    return { value, newIndex: idx };
                } else {
                    const value = new FunctionCall(functionName, arg, null);
                    return { value, newIndex: idx };
                }
            } else {
                throw new Error(`Missing closing parenthesis for function '${functionName}' at index ${idx}`);
            }
        } else {
            throw new Error(`Missing opening parenthesis for function '${functionName}' at index ${idx}`);
        }
    }

    public static parseTypeValue(lexemes: Lexeme[], index: number): { value: TypeValue; newIndex: number; } {
        let idx = index;
        // Check for type value
        if (idx < lexemes.length && (lexemes[idx].type === TokenType.Type || lexemes[idx].maybeType === true)) {
            const typeName = lexemes[idx].value;
            idx++;

            // Check for array type
            if (idx < lexemes.length && lexemes[idx].type === TokenType.OpenParen) {
                const arg = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
                idx = arg.newIndex;
                const value = new TypeValue(typeName, arg.value);
                return { value, newIndex: idx };
            } else {
                // Create TypeValue
                const value = new TypeValue(typeName);
                return { value, newIndex: idx };
            }
        }
        throw new Error(`Expected type value at index ${idx}`);
    }
}