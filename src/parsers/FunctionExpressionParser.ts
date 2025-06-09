import { Lexeme, TokenType } from "../models/Lexeme";
import { FunctionCall, ValueComponent, BinaryExpression, TypeValue, CastExpression, BetweenExpression, RawString } from "../models/ValueComponent";
import { OverExpressionParser } from "./OverExpressionParser";
import { ValueParser } from "./ValueParser";
import { FullNameParser } from "./FullNameParser";
import { OperatorPrecedence } from "../utils/OperatorPrecedence";

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

    public static tryParseBinaryExpression(lexemes: Lexeme[], index: number, left: ValueComponent, allowAndOperator: boolean = true, allowOrOperator: boolean = true): { value: ValueComponent; newIndex: number } | null {
        let idx = index;

        // If the next element is an operator, process it as a binary expression
        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Operator)) {
            const operator = lexemes[idx].value.toLowerCase();

            if (!allowAndOperator && operator === "and") {
                // Handle special case for "and" operator
                return null;
            }

            if (!allowOrOperator && operator === "or") {
                // Handle special case for "or" operator
                return null;
            }

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

        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Operator) && lexemes[idx].value !== "and") {
            throw new Error(`Expected 'and' after 'between' at index ${idx}`);
        }
        idx++;

        // Parse upper bound with restricted scope - stop at logical operators
        const upper = this.parseBetweenUpperBound(lexemes, idx);
        idx = upper.newIndex;
        const result = new BetweenExpression(value, lower.value, upper.value, negated);
        return { value: result, newIndex: idx };
    }

    /**
     * Parse the upper bound of a BETWEEN expression with logical operator precedence
     * This stops parsing when it encounters AND/OR operators at the same level
     */
    private static parseBetweenUpperBound(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        // Parse with higher precedence than AND/OR to ensure BETWEEN binds tighter
        // Use precedence 3 (higher than AND=2, OR=1) as minimum to stop at logical operators
        return ValueParser.parseFromLexeme(lexemes, index, false, false);
    }

    private static parseFunctionCall(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Parse namespaced function name (e.g., myschema.myfunc, dbo.util.myfunc)
        // Use FullNameParser to get namespaces and function name
        const fullNameResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const namespaces = fullNameResult.namespaces;
        const name = fullNameResult.name;
        idx = fullNameResult.newIndex;

        if (idx < lexemes.length && (lexemes[idx].type & TokenType.OpenParen)) {
            // General argument parsing
            const arg = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            idx = arg.newIndex;

            if (idx < lexemes.length && lexemes[idx].value === "over") {
                const over = OverExpressionParser.parseFromLexeme(lexemes, idx);
                idx = over.newIndex;
                const value = new FunctionCall(namespaces, name.name, arg.value, over.value);
                return { value, newIndex: idx };
            } else {
                const value = new FunctionCall(namespaces, name.name, arg.value, null);
                return { value, newIndex: idx };
            }
        } else {
            throw new Error(`Expected opening parenthesis after function name '${name.name}' at index ${idx}`);
        }
    }

    private static parseKeywordFunction(
        lexemes: Lexeme[],
        index: number,
        keywords: { key: string, required: boolean }[]
    ): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        // Parse function name and namespaces at the beginning for consistent usage
        const fullNameResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const namespaces = fullNameResult.namespaces;
        const name = fullNameResult.name;
        idx = fullNameResult.newIndex;

        if (idx < lexemes.length && (lexemes[idx].type & TokenType.OpenParen)) {
            idx++;

            const input = ValueParser.parseFromLexeme(lexemes, idx);
            let arg = input.value;
            idx = input.newIndex;

            // Delegate to the standard function parser if parsing by comma
            if (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
                return this.parseFunctionCall(lexemes, index);
            }

            // Check for required/optional keywords in function arguments
            for (const { key, required } of keywords) {
                if (idx < lexemes.length && (lexemes[idx].type & TokenType.Command) && lexemes[idx].value === key) {
                    idx++;

                    if (idx < lexemes.length && (lexemes[idx].type & TokenType.Type)) {
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

            if (idx < lexemes.length && (lexemes[idx].type & TokenType.CloseParen)) {
                idx++;
                // Use the previously parsed namespaces and function name for consistency
                if (idx < lexemes.length && lexemes[idx].value === "over") {
                    idx++;
                    const over = OverExpressionParser.parseFromLexeme(lexemes, idx);
                    idx = over.newIndex;
                    const value = new FunctionCall(namespaces, name.name, arg, over.value);
                    return { value, newIndex: idx };
                } else {
                    const value = new FunctionCall(namespaces, name.name, arg, null);
                    return { value, newIndex: idx };
                }
            } else {
                throw new Error(`Missing closing parenthesis for function '${name.name}' at index ${idx}`);
            }
        } else {
            throw new Error(`Missing opening parenthesis for function '${name.name}' at index ${idx}`);
        }
    }

    public static parseTypeValue(lexemes: Lexeme[], index: number): { value: TypeValue; newIndex: number; } {
        let idx = index;

        const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
        idx = newIndex;

        if (idx < lexemes.length && (lexemes[idx].type & TokenType.OpenParen)) {
            const arg = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            idx = arg.newIndex;
            const value = new TypeValue(namespaces, new RawString(name.name), arg.value);
            return { value, newIndex: idx };
        } else {
            const value = new TypeValue(namespaces, new RawString(name.name));
            return { value, newIndex: idx };
        }
    }
}