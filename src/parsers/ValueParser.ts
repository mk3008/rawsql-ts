import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference, ValueComponent, LiteralValue, BinaryExpression, ParenExpression, FunctionCall, ValueList, UnaryExpression, ParameterExpression, ArrayExpression, CaseExpression, SwitchCaseArgument, CaseKeyValuePair as CaseConditionValuePair, BetweenExpression, StringSpecifierExpression, TypeValue, CastExpression, RawString } from "../models/ValueComponent";
import { literalKeywordParser } from "../tokenReaders/LiteralTokenReader";
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
        let idx = index;

        // support comments
        const comment = lexemes[index].comments;
        let left = this.ParseItem(lexemes, index);
        left.value.comments = comment;
        idx = left.newIndex;

        while (idx < lexemes.length && lexemes[idx].type === TokenType.Operator) {
            const binaryResult = this.tryParseBinaryExpression(lexemes, idx, left.value, allowAndOperator);
            if (binaryResult) {
                left.value = binaryResult.value;
                idx = binaryResult.newIndex;
            } else {
                // If no binary expression is found, break the loop
                break;
            }
        }

        return { value: left.value, newIndex: idx };
    }

    private static tryParseBinaryExpression(lexemes: Lexeme[], index: number, left: ValueComponent, allowAndOperator: boolean = true): { value: ValueComponent; newIndex: number } | null {
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
                return this.ParseBetweenExpression(lexemes, idx, left, false);
            } else if (operator === "not between") {
                return this.ParseBetweenExpression(lexemes, idx, left, true);
            }

            // ::
            if (operator === "::") {
                const typeValue = this.ParseTypeValue(lexemes, idx);
                idx = typeValue.newIndex;
                const exp = new CastExpression(left, typeValue.value);
                return { value: exp, newIndex: idx };
            }

            // Get the right-hand side value
            const rightResult = this.Parse(lexemes, idx);
            idx = rightResult.newIndex;

            // Create binary expression
            const value = new BinaryExpression(left, operator, rightResult.value);
            return { value, newIndex: idx };
        }

        return null;
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

        // Parse the first WHEN clause
        const casewhenResult = this.ParseCaseConditionValuePair(lexemes, idx);
        idx = casewhenResult.newIndex;

        // Add the initial WHEN-THEN pair to the list
        const caseWhenList: CaseConditionValuePair[] = [casewhenResult.value];

        // Process remaining WHEN-ELSE-END parts
        const switchCaseResult = this.ParseSwitchCaseArgument(lexemes, idx, caseWhenList);
        idx = switchCaseResult.newIndex;

        // Create CASE expression with condition null (uses WHEN conditions instead of a simple CASE)
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
        while (idx < lexemes.length && this.isCommandWithValue(lexemes[idx], "when")) {
            idx++;
            const whenResult = this.ParseCaseConditionValuePair(lexemes, idx);
            idx = whenResult.newIndex;
            whenThenList.push(whenResult.value);
        }

        // Process ELSE
        if (idx < lexemes.length && this.isCommandWithValue(lexemes[idx], "else")) {
            idx++;
            const elseResult = this.Parse(lexemes, idx);
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
        return lexeme.type === TokenType.Command && lexeme.value === value;
    }

    private static ParseCaseConditionValuePair(lexemes: Lexeme[], index: number): { value: CaseConditionValuePair; newIndex: number; } {
        let idx = index;
        const condition = this.Parse(lexemes, idx);
        idx = condition.newIndex;

        // Check for the existence of the THEN keyword
        if (idx >= lexemes.length || lexemes[idx].type !== TokenType.Command || lexemes[idx].value !== "then") {
            throw new Error(`Expected 'then' after WHEN condition at index ${idx}`);
        }
        idx++; // Skip the THEN keyword

        // Parse the value after THEN
        const value = this.Parse(lexemes, idx);
        idx = value.newIndex;

        return { value: new CaseConditionValuePair(condition.value, value.value), newIndex: idx };
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

        const lex = literalKeywordParser.parse(valueText.toLowerCase(), 0);
        if (lex) {
            const value = new RawString(lex.keyword);
            idx++
            return { value, newIndex: idx };
        }

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
