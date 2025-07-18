import { Lexeme, TokenType } from "../models/Lexeme";
import { FunctionCall, ValueComponent, BinaryExpression, TypeValue, CastExpression, BetweenExpression, RawString, ArrayExpression, ArrayQueryExpression } from "../models/ValueComponent";
import { SelectQuery } from "../models/SelectQuery";
import { OrderByClause } from "../models/Clause";
import { OverExpressionParser } from "./OverExpressionParser";
import { ValueParser } from "./ValueParser";
import { FullNameParser } from "./FullNameParser";
import { SelectQueryParser } from "./SelectQueryParser";
import { OrderByClauseParser } from "./OrderByClauseParser";
import { ParseError } from "./ParseError";

export class FunctionExpressionParser {
    /**
     * Parse ARRAY expressions - handles both ARRAY[...] (literal) and ARRAY(...) (query) syntax
     * @param lexemes Array of lexemes to parse
     * @param index Current parsing index
     * @returns Parsed array expression and new index
     */
    private static parseArrayExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Check if this is array literal (ARRAY[...]) or function call (ARRAY(...))
        if (idx + 1 < lexemes.length && (lexemes[idx + 1].type & TokenType.OpenBracket)) {
            idx++;
            const arg = ValueParser.parseArgument(TokenType.OpenBracket, TokenType.CloseBracket, lexemes, idx);
            idx = arg.newIndex;
            const value = new ArrayExpression(arg.value);
            return { value, newIndex: idx };
        } else if (idx + 1 < lexemes.length && (lexemes[idx + 1].type & TokenType.OpenParen)) {
            idx++;
            idx++; // Skip the opening parenthesis
            const arg = SelectQueryParser.parseFromLexeme(lexemes, idx);
            idx = arg.newIndex;
            idx++; // Skip the closing parenthesis
            const value = new ArrayQueryExpression(arg.value);
            return { value, newIndex: idx };
        }

        throw new Error(`Invalid ARRAY syntax at index ${idx}, expected ARRAY[... or ARRAY(...)`);
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        const current = lexemes[idx];

        if (current.value === "array") {
            return this.parseArrayExpression(lexemes, idx);
        } else if (current.value === "substring" || current.value === "overlay") {
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

            // Check for WITHIN GROUP clause
            let withinGroup: OrderByClause | null = null;
            if (idx < lexemes.length && lexemes[idx].value === "within group") {
                const withinGroupResult = this.parseWithinGroupClause(lexemes, idx);
                withinGroup = withinGroupResult.value;
                idx = withinGroupResult.newIndex;
            }

            if (idx < lexemes.length && lexemes[idx].value === "over") {
                const over = OverExpressionParser.parseFromLexeme(lexemes, idx);
                idx = over.newIndex;
                const value = new FunctionCall(namespaces, name.name, arg.value, over.value, withinGroup);
                return { value, newIndex: idx };
            } else {
                const value = new FunctionCall(namespaces, name.name, arg.value, null, withinGroup);
                return { value, newIndex: idx };
            }
        } else {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected opening parenthesis after function name '${name.name}'.`);
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
                    throw ParseError.fromUnparsedLexemes(lexemes, idx, `Keyword '${key}' is required for ${name.name} function.`);
                }
            }

            if (idx < lexemes.length && (lexemes[idx].type & TokenType.CloseParen)) {
                idx++;
                
                // Check for WITHIN GROUP clause
                let withinGroup: OrderByClause | null = null;
                if (idx < lexemes.length && lexemes[idx].value === "within group") {
                    const withinGroupResult = this.parseWithinGroupClause(lexemes, idx);
                    withinGroup = withinGroupResult.value;
                    idx = withinGroupResult.newIndex;
                }
                
                // Use the previously parsed namespaces and function name for consistency
                if (idx < lexemes.length && lexemes[idx].value === "over") {
                    idx++;
                    const over = OverExpressionParser.parseFromLexeme(lexemes, idx);
                    idx = over.newIndex;
                    const value = new FunctionCall(namespaces, name.name, arg, over.value, withinGroup);
                    return { value, newIndex: idx };
                } else {
                    const value = new FunctionCall(namespaces, name.name, arg, null, withinGroup);
                    return { value, newIndex: idx };
                }
            } else {
                throw ParseError.fromUnparsedLexemes(lexemes, idx, `Missing closing parenthesis for function '${name.name}'.`);
            }
        } else {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Missing opening parenthesis for function '${name.name}'.`);
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

    /**
     * Parse WITHIN GROUP (ORDER BY ...) clause
     * @param lexemes Array of lexemes to parse
     * @param index Current parsing index (should point to "WITHIN GROUP")
     * @returns Parsed OrderByClause and new index
     */
    private static parseWithinGroupClause(lexemes: Lexeme[], index: number): { value: OrderByClause; newIndex: number } {
        let idx = index;

        // Expect "WITHIN GROUP" (now a single token)
        if (idx >= lexemes.length || lexemes[idx].value !== "within group") {
            throw new Error(`Expected 'WITHIN GROUP' at index ${idx}`);
        }
        idx++;

        // Expect "("
        if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.OpenParen)) {
            throw new Error(`Expected '(' after 'WITHIN GROUP' at index ${idx}`);
        }
        idx++;

        // Parse ORDER BY clause
        const orderByResult = OrderByClauseParser.parseFromLexeme(lexemes, idx);
        idx = orderByResult.newIndex;

        // Expect ")"
        if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.CloseParen)) {
            throw new Error(`Expected ')' after WITHIN GROUP ORDER BY clause at index ${idx}`);
        }
        idx++;

        return { value: orderByResult.value, newIndex: idx };
    }
}