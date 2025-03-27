import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference, ValueComponent, LiteralValue, BinaryExpression, ParenExpression, FunctionCall, ValueList, UnaryExpression, ParameterExpression, ArrayExpression, CaseExpression, SwitchCaseArgument, CaseKeyValuePair as CaseConditionValuePair, BetweenExpression, StringSpecifierExpression, TypeValue, CastExpression } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";

export class ValueParser {
    public static ParseFromText(query: string): ValueComponent {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.Parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Unexpected token at index ${result.newIndex}: ${lexemes[result.newIndex].value}`);
        }

        return result.value;
    }

    public static Parse(lexemes: Lexeme[], index: number, allowAndOperator: boolean = true): { value: ValueComponent; newIndex: number } {
        // support comments
        const comment = lexemes[index].comments;
        const result = this.ParseCore(lexemes, index, allowAndOperator);
        result.value.comments = comment;
        return result;
    }

    private static ParseCore(lexemes: Lexeme[], index: number, allowAndOperator: boolean = true): { value: ValueComponent; newIndex: number } {
        let idx = index;
        const result = this.ParseItem(lexemes, idx);
        idx = result.newIndex;

        // If the next element is an operator, process it as a binary expression
        if (idx < lexemes.length && lexemes[idx].type === TokenType.Operator) {
            if (!allowAndOperator && lexemes[idx].value === "and") {
                // Handle special case for "and" operator
                return { value: result.value, newIndex: idx };
            }

            const operator = lexemes[idx].value as string;
            idx++;

            // between
            if (operator === "between") {
                return this.ParseBetweenExpression(lexemes, idx, result.value, false);
            } else if (operator === "not between") {
                return this.ParseBetweenExpression(lexemes, idx, result.value, true);
            }

            // ::
            if (operator === "::") {
                const typeValue = this.ParseTypeValue(lexemes, idx);
                idx = typeValue.newIndex;
                const exp = new CastExpression(result.value, typeValue.value);
                return { value: exp, newIndex: idx };
            }

            // Get the right-hand side value
            const rightResult = this.Parse(lexemes, idx);
            idx = rightResult.newIndex;

            // Create binary expression
            const value = new BinaryExpression(result.value, operator, rightResult.value);
            return { value, newIndex: idx };
        }

        return { value: result.value, newIndex: idx };
    }

    private static ParseTypeValue(lexemes: Lexeme[], index: number): { value: TypeValue; newIndex: number; } {
        let idx = index;
        // Check for type value
        if (idx < lexemes.length && (lexemes[idx].type === TokenType.Type || lexemes[idx].maybeType === true)) {
            const typeName = lexemes[idx].value;
            idx++;

            // Check for array type
            if (idx < lexemes.length && lexemes[idx].type === TokenType.OpenParen) {
                const arg = this.ParseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
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

    private static ParseBetweenExpression(lexemes: Lexeme[], index: number, value: ValueComponent, negated: boolean): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        const lower = this.Parse(lexemes, idx, false);
        idx = lower.newIndex;

        if (idx < lexemes.length && lexemes[idx].type === TokenType.Operator && lexemes[idx].value !== "and") {
            throw new Error(`Expected 'and' after 'between' at index ${idx}`);
        }
        idx++;

        const upper = this.Parse(lexemes, idx);
        idx = upper.newIndex;
        const result = new BetweenExpression(value, lower.value, upper.value, negated);
        return { value: result, newIndex: idx };
    }

    private static ParseItem(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Range check
        if (idx >= lexemes.length) {
            throw new Error(`Unexpected end of lexemes at index ${index}`);
        }

        const current = lexemes[idx];

        if (current.type === TokenType.Identifier) {
            return this.ParseIdentifier(lexemes, idx);
        } else if (current.type === TokenType.Literal) {
            return this.ParseLiteralValue(lexemes, idx);
        } else if (current.type === TokenType.OpenParen) {
            return this.ParseParenExpression(lexemes, idx);
        } else if (current.type === TokenType.Function) {
            if (current.value === "substring" || current.value === "overlay") {
                return this.ParseKeywordFunction(lexemes, idx, [
                    { key: "from", required: false },
                    { key: "for", required: false }
                ]);
            } else if (current.value === "cast") {
                return this.ParseKeywordFunction(lexemes, idx, [
                    { key: "as", required: true }
                ]);
            } else if (current.value === "trim") {
                return this.ParseKeywordFunction(lexemes, idx, [
                    { key: "from", required: false }
                ]);
            }
            return this.ParseFunctionCall(lexemes, idx);
        } else if (current.type === TokenType.Operator) {
            return this.ParseUnaryExpression(lexemes, idx);
        } else if (current.type === TokenType.Parameter) {
            return this.ParseParameterExpression(lexemes, idx);
        } else if (current.type === TokenType.StringSpecifier) {
            return this.ParseStringSpecifierExpression(lexemes, idx);
        } else if (current.type === TokenType.Command) {
            if (current.value === "case") {
                idx++;
                return this.ParseCaseExpression(lexemes, idx);
            } else if (current.value === "case when") {
                idx++;
                return this.ParseCaseWhenExpression(lexemes, idx);
            } else if (current.value === "array") {
                idx++;
                return this.ParseArrayExpression(lexemes, idx);
            }
            return this.ParseModifierUnaryExpression(lexemes, idx);
        }

        throw new Error(`Invalid lexeme. index: ${idx}, type: ${lexemes[idx].type}, value: ${lexemes[idx].value}`);
    }

    private static ParseModifierUnaryExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        // Check for modifier unary expression
        if (idx < lexemes.length && lexemes[idx].type === TokenType.Command) {
            const command = lexemes[idx].value;
            idx++;
            const result = this.Parse(lexemes, idx);
            return { value: new UnaryExpression(command!, result.value), newIndex: result.newIndex };
        }
        throw new Error(`Invalid modifier unary expression at index ${idx}, Lexeme: ${lexemes[idx].value}`);
    }

    private static ParseCastFunction(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number; } {
        let idx = index;

        // Get function name
        const result = lexemes[idx];
        const functionName = result.value;
        idx++;

        if (idx < lexemes.length && lexemes[idx].type === TokenType.OpenParen) {
            idx++;

            const input = this.Parse(lexemes, idx);
            idx = input.newIndex;

            if (idx < lexemes.length && lexemes[idx].type === TokenType.Command && lexemes[idx].value === "as") {
                idx++;

                const castType = this.ParseTypeValue(lexemes, idx);
                idx = castType.newIndex;

                if (idx < lexemes.length && lexemes[idx].type === TokenType.CloseParen) {
                    idx++;
                    const value = new CastExpression(input.value, castType.value);
                    return { value, newIndex: idx };
                } else {
                    throw new Error(`Expected closing parenthesis after function name '${functionName}' at index ${idx}`);
                }
            }
            else {
                return this.ParseFunctionCall(lexemes, index);
            }
        }
        else {
            throw new Error(`Expected opening parenthesis after function name '${functionName}' at index ${idx}`);
        }

    }

    private static ParseTrimFunction(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number; } {
        let idx = index;

        // Get function name
        const result = lexemes[idx];
        const functionName = result.value;
        idx++;

        if (idx < lexemes.length && lexemes[idx].type === TokenType.OpenParen) {
            idx++;
            const arg1 = this.Parse(lexemes, idx);
            idx = arg1.newIndex;
            if (idx < lexemes.length && lexemes[idx].value === "from") {
                idx++;
                const arg2 = this.Parse(lexemes, idx);
                idx = arg2.newIndex;
                if (idx < lexemes.length && lexemes[idx].type === TokenType.CloseParen) {
                    idx++;
                    const arg = new BinaryExpression(arg1.value, "from", arg2.value);
                    const value = new FunctionCall(functionName, arg);
                    return { value, newIndex: idx };
                } else {
                    throw new Error(`Expected closing parenthesis after function name '${functionName}' at index ${idx}`);
                }
            }
            else {
                return this.ParseFunctionCall(lexemes, index);
            }
        }
        else {
            throw new Error(`Expected opening parenthesis after function name '${functionName}' at index ${idx}`);
        }
    }

    private static ParseFunctionCall_FromFor(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number; } {
        let idx = index;

        // Get function name
        const functionName = lexemes[idx].value;
        idx++;

        if (idx < lexemes.length && lexemes[idx].type === TokenType.OpenParen) {
            idx++;

            const input = this.Parse(lexemes, idx);
            let arg = input.value;
            idx = input.newIndex;

            // Check for comma
            if (idx < lexemes.length && lexemes[idx].type === TokenType.Comma) {
                return this.ParseFunctionCall(lexemes, index);
            }

            if (idx < lexemes.length && lexemes[idx].type === TokenType.Command && lexemes[idx].value === "from") {
                idx++;
                const right = this.Parse(lexemes, idx);
                arg = new BinaryExpression(arg, "from", right.value);
                idx = right.newIndex;
            }

            if (idx < lexemes.length && lexemes[idx].type === TokenType.Command && lexemes[idx].value === "for") {
                idx++;
                const right = this.Parse(lexemes, idx);
                arg = new BinaryExpression(arg, "for", right.value);
                idx = right.newIndex;
            }

            if (idx < lexemes.length && lexemes[idx].type === TokenType.CloseParen) {
                idx++;
                // Create SUBSTRING function
                return { value: new FunctionCall(functionName, arg), newIndex: idx };
            } else {
                throw new Error(`Expected closing parenthesis after function name '${functionName}' at index ${idx}`);
            }
        } else {
            throw new Error(`Expected opening parenthesis after function name '${functionName}' at index ${idx}`);
        }
    }

    private static ParseStringSpecifierExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        const specifer = lexemes[idx].value;
        idx++;
        if (idx >= lexemes.length || lexemes[idx].type !== TokenType.Literal) {
            throw new Error(`Expected string literal after string specifier at index ${idx}`);
        }
        const value = lexemes[idx].value;
        idx++;
        // Create StringSpecifierExpression
        const result = new StringSpecifierExpression(specifer, value);

        return { value: result, newIndex: idx };

    }

    private static ParseCaseExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        const condition = this.Parse(lexemes, idx);
        idx = condition.newIndex;

        const switchCaseResult = this.ParseSwitchCaseArgument(lexemes, idx, []);
        idx = switchCaseResult.newIndex;

        // Create CASE expression
        const result = new CaseExpression(condition.value, switchCaseResult.value);
        return { value: result, newIndex: idx };
    }

    private static ParseCaseWhenExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        const casewhenResult = this.ParseCaseConditionValuePair(lexemes, idx);
        idx = casewhenResult.newIndex;

        const caseWhenList: CaseConditionValuePair[] = [casewhenResult.value];
        const switchCaseResult = this.ParseSwitchCaseArgument(lexemes, idx, caseWhenList);
        idx = switchCaseResult.newIndex;

        // Create CASE WHEN expression
        const result = new CaseExpression(null, switchCaseResult.value);
        return { value: result, newIndex: idx };
    }

    // ParseSwitchCaseArgument method processes the WHEN, ELSE, and END clauses of a CASE expression.
    private static ParseSwitchCaseArgument(
        lexemes: Lexeme[],
        index: number,
        initialWhenThenList: CaseConditionValuePair[]
    ): { value: SwitchCaseArgument; newIndex: number; } {
        let idx = index;
        const whenThenList = [...initialWhenThenList];
        let elseValue: ValueComponent | null = null;

        // Process WHEN clauses
        while (idx < lexemes.length && lexemes[idx].type === TokenType.Command && lexemes[idx].value === "when") {
            idx++;
            const whenResult = this.ParseCaseConditionValuePair(lexemes, idx);
            idx = whenResult.newIndex;
            whenThenList.push(whenResult.value);
        }

        // Process ELSE
        if (idx < lexemes.length && lexemes[idx].type === TokenType.Command && lexemes[idx].value === "else") {
            idx++;
            const elseResult = this.Parse(lexemes, idx);
            elseValue = elseResult.value;
            idx = elseResult.newIndex;
        }

        // Process END
        if (idx < lexemes.length && lexemes[idx].type === TokenType.Command && lexemes[idx].value === "end") {
            idx++;
        } else {
            throw new Error(`Expected 'end' after CASE at index ${idx}`);
        }

        if (whenThenList.length === 0) {
            throw new Error(`CASE expression requires at least one WHEN clause at index ${idx}`);
        }

        // Create SwitchCaseArgument
        const value = new SwitchCaseArgument(whenThenList, elseValue);
        return { value, newIndex: idx };
    }

    private static ParseCaseConditionValuePair(lexemes: Lexeme[], index: number): { value: CaseConditionValuePair; newIndex: number; } {
        let idx = index;
        const condition = this.Parse(lexemes, index);
        idx = condition.newIndex;

        if (idx >= lexemes.length || lexemes[idx].type !== TokenType.Command || lexemes[idx].value !== "then") {
            throw new Error(`Expected 'then' after 'case when' at index ${idx}`);
        }
        idx++;
        const value = this.Parse(lexemes, idx);

        const result = new CaseConditionValuePair(condition.value, value.value);
        idx = value.newIndex;
        return { value: result, newIndex: idx };
    }

    private static ParseParameterExpression(lexemes: Lexeme[], newIndex: number): { value: ValueComponent; newIndex: number; } {
        let idx = newIndex;
        // Exclude the parameter symbol (first character)
        const value = new ParameterExpression(lexemes[idx].value.slice(1));
        idx++;
        return { value, newIndex: idx };
    }

    private static ParseLiteralValue(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        // Process literal value
        let idx = index;
        const valueText = lexemes[idx].value;
        let parsedValue: string | number | boolean | null;

        // Check if it is a number
        if (/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(valueText)) {
            parsedValue = Number(valueText);
        }
        // Check if it is a boolean
        else if (valueText.toLowerCase() === 'true') {
            parsedValue = true;
        }
        else if (valueText.toLowerCase() === 'false') {
            parsedValue = false;
        }
        // Check if it is null
        else if (valueText.toLowerCase() === 'null') {
            parsedValue = null;
        }
        // Otherwise, treat it as a string
        else {
            // Remove single quotes if enclosed
            if (valueText.startsWith("'") && valueText.endsWith("'")) {
                parsedValue = valueText.slice(1, -1);
            } else {
                parsedValue = valueText;
            }
        }
        idx++
        const value = new LiteralValue(parsedValue);
        return { value, newIndex: idx };
    }

    private static ParseUnaryExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Process unary operator
        if (idx < lexemes.length && lexemes[idx].type === TokenType.Operator) {
            const operator = lexemes[idx].value;
            idx++;

            // Get the right-hand side value of the unary operator
            const result = this.Parse(lexemes, idx);
            idx = result.newIndex;

            // Create unary expression
            const value = new UnaryExpression(operator, result.value);
            return { value, newIndex: idx };
        }

        throw new Error(`Invalid unary expression at index ${index}: ${lexemes[index].value}`);
    }

    private static ParseIdentifier(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        // Check for column reference pattern ([identifier dot] * n + identifier)
        let idx = index;
        const identifiers: string[] = [];

        // Add the first identifier
        identifiers.push(lexemes[idx].value);
        idx++;

        // Look for dot and identifier pattern
        while (
            idx < lexemes.length &&
            idx + 1 < lexemes.length &&
            lexemes[idx].type === TokenType.Dot &&
            lexemes[idx + 1].type === TokenType.Identifier
        ) {
            // Skip the dot and add the next identifier
            idx++;
            identifiers.push(lexemes[idx].value);
            idx++;
        }

        if (identifiers.length > 1) {
            // If there are multiple identifiers, treat it as a column reference
            const lastIdentifier = identifiers.pop() || '';
            const value = new ColumnReference(identifiers, lastIdentifier);
            return { value, newIndex: idx };
        } else {
            // If there is a single identifier, treat it as a simple identifier
            const value = new ColumnReference(null, identifiers[0]);
            return { value, newIndex: idx };
        }
    }

    private static ParseArrayExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        // Array function is enclosed in []
        const arg = this.ParseBracket(lexemes, idx);
        idx = arg.newIndex;
        const value = new ArrayExpression(arg.value);
        return { value, newIndex: idx };
    }

    private static ParseFunctionCall(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Get function name
        const result = lexemes[idx];
        const functionName = result.value;
        idx++;

        if (idx < lexemes.length && lexemes[idx].type === TokenType.OpenParen) {
            // General argument parsing
            const arg = this.ParseParen(lexemes, idx);
            idx = arg.newIndex;
            const value = new FunctionCall(functionName, arg.value);
            return { value, newIndex: idx };
        } else {
            throw new Error(`Expected opening parenthesis after function name '${functionName}' at index ${idx}`);
        }
    }

    private static ParseParenExpression(lexemes: Lexeme[], index: number): { value: ParenExpression; newIndex: number } {
        let idx = index;

        const result = this.ParseParen(lexemes, idx);
        idx = result.newIndex;

        const value = new ParenExpression(result.value);
        return { value, newIndex: idx };
    }

    private static ParseParen(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        return this.ParseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, index);
    }

    private static ParseBracket(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        return this.ParseArgument(TokenType.OpenBracket, TokenType.CloseBracket, lexemes, index);
    }

    public static ParseArgument(openToken: TokenType, closeToken: TokenType, lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        let args: ValueComponent[] = [];

        // Check for opening parenthesis
        if (idx < lexemes.length && lexemes[idx].type === openToken) {
            idx++;

            // If the next element is `*`, treat `*` as an Identifier
            if (idx < lexemes.length && lexemes[idx].value === "*") {
                const wildcard = new ColumnReference(null, "*");
                idx++;
                // The next element must be closeToken
                if (idx < lexemes.length && lexemes[idx].type === closeToken) {
                    idx++;
                    return { value: wildcard, newIndex: idx };
                } else {
                    throw new Error(`Expected closing parenthesis at index ${idx}`);
                }
            }

            // Parse the value inside
            const result = this.Parse(lexemes, idx);
            idx = result.newIndex;
            args.push(result.value);

            // Continue reading if the next element is a comma
            while (idx < lexemes.length && lexemes[idx].type === TokenType.Comma) {
                idx++;
                const argResult = this.Parse(lexemes, idx);
                idx = argResult.newIndex;
                args.push(argResult.value);
            }

            // Check for closing parenthesis
            if (idx < lexemes.length && lexemes[idx].type === closeToken) {
                idx++;
                if (args.length === 1) {
                    // Return as is if there is only one argument
                    return { value: args[0], newIndex: idx };
                }
                // Create ValueCollection if there are multiple arguments
                const value = new ValueList(args);
                return { value, newIndex: idx };
            } else {
                throw new Error(`Missing closing parenthesis at index ${idx}`);
            }
        }

        throw new Error(`Expected opening parenthesis at index ${index}`);
    }

    private static ParseKeywordFunction(
        lexemes: Lexeme[],
        index: number,
        keywords: { key: string, required: boolean }[]
    ): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        const functionName = lexemes[idx].value;
        idx++;

        if (idx < lexemes.length && lexemes[idx].type === TokenType.OpenParen) {
            idx++;

            const input = this.Parse(lexemes, idx);
            let arg = input.value;
            idx = input.newIndex;

            // Delegate to the standard function parser if parsing by comma
            if (idx < lexemes.length && lexemes[idx].type === TokenType.Comma) {
                return this.ParseFunctionCall(lexemes, index);
            }

            // Check keywords
            for (const { key, required } of keywords) {
                if (idx < lexemes.length && lexemes[idx].type === TokenType.Command && lexemes[idx].value === key) {
                    idx++;

                    if (idx < lexemes.length && (lexemes[idx].type === TokenType.Type || lexemes[idx].maybeType === true)) {
                        const typeValue = this.ParseTypeValue(lexemes, idx);
                        arg = new BinaryExpression(arg, key, typeValue.value);
                        idx = typeValue.newIndex;
                    } else {
                        const right = this.Parse(lexemes, idx);
                        arg = new BinaryExpression(arg, key, right.value);
                        idx = right.newIndex;
                    }

                } else if (required) {
                    throw new Error(`Keyword '${key}' is required at index ${idx}`);
                }
            }

            if (idx < lexemes.length && lexemes[idx].type === TokenType.CloseParen) {
                idx++;
                return { value: new FunctionCall(functionName, arg), newIndex: idx };
            } else {
                throw new Error(`Missing closing parenthesis for function '${functionName}' at index ${idx}`);
            }
        } else {
            throw new Error(`Missing opening parenthesis for function '${functionName}' at index ${idx}`);
        }
    }
}
