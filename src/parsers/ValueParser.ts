import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference, ValueComponent, LiteralValue, BinaryExpression, ParenExpression, FunctionCall, ValueCollection, UnaryExpression, ParameterExpression, ArrayExpression, CaseExpression, SwitchCaseArgument, CaseKeyValuePair as CaseConditionValuePair, BetweenExpression, StringSpecifierExpression, ModifierExpression, TypeValue, CastExpression, SubstringFromForArgument, SubstringSimilarArgument } from "../models/ValueComponent";
import { SqlTokenizer } from "../sqlTokenizer";

export class ValueParser {
    public static ParseFromText(query: string): ValueComponent {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.Parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newPosition < lexemes.length) {
            throw new Error(`Unexpected token at position ${result.newPosition}: ${lexemes[result.newPosition].value}`);
        }

        return result.value;
    }

    public static Parse(lexemes: Lexeme[], position: number, allowAndOperator: boolean = true): { value: ValueComponent; newPosition: number } {
        let p = position;
        const result = this.ParseItem(lexemes, p);
        p = result.newPosition;

        // If the next element is an operator, process it as a binary expression
        if (p < lexemes.length && lexemes[p].type === TokenType.Operator) {
            if (!allowAndOperator && lexemes[p].command === "and") {
                // Handle special case for "and" operator
                return { value: result.value, newPosition: p };
            }

            const operator = lexemes[p].command as string;
            p++;

            // between
            if (operator === "between") {
                return this.ParseBetweenExpression(lexemes, p, result.value, false);
            } else if (operator === "not between") {
                return this.ParseBetweenExpression(lexemes, p, result.value, true);
            }

            // ::
            if (operator === "::") {
                return this.ParseTypeValue(lexemes, p, result.value);
            }

            // Get the right-hand side value
            const rightResult = this.Parse(lexemes, p);
            p = rightResult.newPosition;

            // Create binary expression
            const value = new BinaryExpression(result.value, operator, rightResult.value);
            return { value, newPosition: p };
        }

        return { value: result.value, newPosition: p };
    }

    static ParseTypeValue(lexemes: Lexeme[], position: number, value: ValueComponent): { value: ValueComponent; newPosition: number; } {
        let p = position;
        // Check for type value
        if (p < lexemes.length && lexemes[p].type === TokenType.Type) {
            const typeValue = new TypeValue(lexemes[p].value);
            p++;
            const result = new CastExpression(value, typeValue);
            return { value: result, newPosition: p };
        }
        throw new Error(`Expected type value at position ${p}`);
    }

    static ParseBetweenExpression(lexemes: Lexeme[], position: number, value: ValueComponent, negated: boolean): { value: ValueComponent; newPosition: number; } {
        let p = position;
        const lower = this.Parse(lexemes, p, false);
        p = lower.newPosition;

        if (p < lexemes.length && lexemes[p].type === TokenType.Operator && lexemes[p].command !== "and") {
            throw new Error(`Expected 'and' after 'between' at position ${p}`);
        }
        p++;

        const upper = this.Parse(lexemes, p);
        p = upper.newPosition;
        const result = new BetweenExpression(value, lower.value, upper.value, negated);
        return { value: result, newPosition: p };
    }

    private static ParseItem(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let p = position;

        // Range check
        if (p >= lexemes.length) {
            throw new Error(`Unexpected end of lexemes at position ${position}`);
        }

        const current = lexemes[p];

        if (current.type === TokenType.Identifier) {
            return this.ParseIdentifier(lexemes, p);
        } else if (current.type === TokenType.Literal) {
            return this.ParseLiteralValue(lexemes, p);
        } else if (current.type === TokenType.OpenParen) {
            return this.ParseParenExpression(lexemes, p);
        } else if (current.type === TokenType.Function) {
            if (current.command === "substring") {
                // Use a dedicated parser for substring as it uses special tokens (from, for) within the function.
                return this.ParseSubstringFunction(lexemes, p);
            }
            else if (current.command === "trim") {
                // Use a dedicated parser for trim as it uses special tokens (from) within the function.
                return this.ParseTrimFunction(lexemes, p);
            }
            return this.ParseFunctionCall(lexemes, p);
        } else if (current.type === TokenType.Operator) {
            return this.ParseUnaryExpression(lexemes, p);
        } else if (current.type === TokenType.Parameter) {
            return this.ParseParameterExpression(lexemes, p);
        } else if (current.type === TokenType.StringSpecifier) {
            return this.ParseStringSpecifierExpression(lexemes, p);
        } else if (current.type === TokenType.Command) {
            p++;
            if (current.command === "case") {
                return this.ParseCaseExpression(lexemes, p);
            } else if (current.command === "case when") {
                return this.ParseCaseWhenExpression(lexemes, p);
            } else if (current.command === "array") {
                return this.ParseArrayExpression(lexemes, p);
            }
            return this.ParseModifierExpression(lexemes, p, current);
        }

        throw new Error(`Invalid lexeme. position: ${position}, type: ${lexemes[position].type}, value: ${lexemes[position].value}`);
    }

    static ParseTrimFunction(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number; } {
        let p = position;

        // Get function name
        const result = lexemes[p];
        const functionName = result.value;
        p++;

        if (p < lexemes.length && lexemes[p].type === TokenType.OpenParen) {
            p++;
            const arg1 = this.Parse(lexemes, p);
            p = arg1.newPosition;
            if (p < lexemes.length && lexemes[p].command === "from") {
                p++;
                const arg2 = this.Parse(lexemes, p);
                p = arg2.newPosition;
                if (p < lexemes.length && lexemes[p].type === TokenType.CloseParen) {
                    p++;
                    const arg = new BinaryExpression(arg1.value, "from", arg2.value);
                    const value = new FunctionCall(functionName, arg);
                    return { value, newPosition: p };
                } else {
                    throw new Error(`Expected closing parenthesis after function name '${functionName}' at position ${p}`);
                }
            }
            else {
                return this.ParseFunctionCall(lexemes, position);
            }
        }
        else {
            throw new Error(`Expected opening parenthesis after function name '${functionName}' at position ${p}`);
        }
    }

    static ParseSubstringFunction(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number; } {
        let p = position;

        // Get function name
        const result = lexemes[p];
        const functionName = result.value;
        p++;

        if (p < lexemes.length && lexemes[p].type === TokenType.OpenParen) {
            p++;

            const input = this.Parse(lexemes, p);
            p = input.newPosition;

            // Check for comma
            if (p < lexemes.length && lexemes[p].type === TokenType.Comma) {
                return this.ParseFunctionCall(lexemes, position);
            }

            // check for similar
            if (p < lexemes.length && lexemes[p].type === TokenType.Command && lexemes[p].command === "similar") {
                p++;
                const pattern = this.Parse(lexemes, p);
                p = pattern.newPosition;

                if (p < lexemes.length && lexemes[p].type === TokenType.CloseParen) {
                    p++;
                    // Create SUBSTRING function
                    const arg = new SubstringSimilarArgument(input.value, pattern.value);
                    return { value: new FunctionCall(functionName, arg), newPosition: p };
                } else {
                    throw new Error(`Expected closing parenthesis after function name '${functionName}' at position ${p}`);
                }
            }

            let startArg;
            let lengthArg;
            if (p < lexemes.length && lexemes[p].type === TokenType.Command && lexemes[p].command === "from") {
                p++;
                startArg = this.Parse(lexemes, p);
                p = startArg.newPosition;
            }
            if (p < lexemes.length && lexemes[p].type === TokenType.Command && lexemes[p].command === "for") {
                p++;
                lengthArg = this.Parse(lexemes, p);
                p = lengthArg.newPosition;
            }
            if (p < lexemes.length && lexemes[p].type === TokenType.CloseParen) {
                p++;
                // Create SUBSTRING function
                const arg = new SubstringFromForArgument(input.value, startArg?.value ?? null, lengthArg?.value ?? null);
                return { value: new FunctionCall(functionName, arg), newPosition: p };
            } else {
                throw new Error(`Expected closing parenthesis after function name '${functionName}' at position ${p}`);
            }
        } else {
            throw new Error(`Expected opening parenthesis after function name '${functionName}' at position ${p}`);
        }
    }

    static ParseModifierExpression(lexemes: Lexeme[], position: number, command: Lexeme): { value: ValueComponent; newPosition: number; } {
        let p = position;
        const value = this.Parse(lexemes, p);
        p = value.newPosition;
        const result = new ModifierExpression(command.value, value.value);
        return { value: result, newPosition: p };
    }

    static ParseStringSpecifierExpression(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number; } {
        let p = position;
        const specifer = lexemes[p].value;
        p++;
        if (p >= lexemes.length || lexemes[p].type !== TokenType.Literal) {
            throw new Error(`Expected string literal after string specifier at position ${p}`);
        }
        const value = lexemes[p].value;
        p++;
        // Create StringSpecifierExpression
        const result = new StringSpecifierExpression(specifer, value);

        return { value: result, newPosition: p };

    }

    static ParseCaseExpression(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number; } {
        let p = position;
        const condition = this.Parse(lexemes, p);
        p = condition.newPosition;

        const switchCaseResult = this.ParseSwitchCaseArgument(lexemes, p, []);
        p = switchCaseResult.newPosition;

        // Create CASE expression
        const result = new CaseExpression(condition.value, switchCaseResult.value);
        return { value: result, newPosition: p };
    }

    static ParseCaseWhenExpression(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number; } {
        let p = position;
        const casewhenResult = this.ParseCaseConditionValuePair(lexemes, p);
        p = casewhenResult.newPosition;

        const caseWhenList: CaseConditionValuePair[] = [casewhenResult.value];
        const switchCaseResult = this.ParseSwitchCaseArgument(lexemes, p, caseWhenList);
        p = switchCaseResult.newPosition;

        // Create CASE WHEN expression
        const result = new CaseExpression(null, switchCaseResult.value);
        return { value: result, newPosition: p };
    }

    // ParseSwitchCaseArgument method processes the WHEN, ELSE, and END clauses of a CASE expression.
    static ParseSwitchCaseArgument(
        lexemes: Lexeme[],
        position: number,
        initialWhenThenList: CaseConditionValuePair[]
    ): { value: SwitchCaseArgument; newPosition: number; } {
        let p = position;
        const whenThenList = [...initialWhenThenList];
        let elseValue: ValueComponent | null = null;

        // Process WHEN clauses
        while (p < lexemes.length && lexemes[p].type === TokenType.Command && lexemes[p].command === "when") {
            p++;
            const whenResult = this.ParseCaseConditionValuePair(lexemes, p);
            p = whenResult.newPosition;
            whenThenList.push(whenResult.value);
        }

        // Process ELSE
        if (p < lexemes.length && lexemes[p].type === TokenType.Command && lexemes[p].command === "else") {
            p++;
            const elseResult = this.Parse(lexemes, p);
            elseValue = elseResult.value;
            p = elseResult.newPosition;
        }

        // Process END
        if (p < lexemes.length && lexemes[p].type === TokenType.Command && lexemes[p].command === "end") {
            p++;
        } else {
            throw new Error(`Expected 'end' after CASE at position ${p}`);
        }

        if (whenThenList.length === 0) {
            throw new Error(`CASE expression requires at least one WHEN clause at position ${p}`);
        }

        // Create SwitchCaseArgument
        const value = new SwitchCaseArgument(whenThenList, elseValue);
        return { value, newPosition: p };
    }

    static ParseCaseConditionValuePair(lexemes: Lexeme[], position: number): { value: CaseConditionValuePair; newPosition: number; } {
        let p = position;
        const condition = this.Parse(lexemes, position);
        p = condition.newPosition;

        if (p >= lexemes.length || lexemes[p].type !== TokenType.Command || lexemes[p].command !== "then") {
            throw new Error(`Expected 'then' after 'case when' at position ${p}`);
        }
        p++;
        const value = this.Parse(lexemes, p);

        const result = new CaseConditionValuePair(condition.value, value.value);
        p = value.newPosition;
        return { value: result, newPosition: p };
    }

    private static ParseParameterExpression(lexemes: Lexeme[], newPosition: number): { value: ValueComponent; newPosition: number; } {
        let p = newPosition;
        // Exclude the parameter symbol (first character)
        const value = new ParameterExpression(lexemes[p].value.slice(1));
        p++;
        return { value, newPosition: p };
    }

    private static ParseLiteralValue(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        // Process literal value
        let p = position;
        const valueText = lexemes[p].value;
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
        p++
        const value = new LiteralValue(parsedValue);
        return { value, newPosition: p };
    }

    private static ParseUnaryExpression(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let p = position;

        // Process unary operator
        if (p < lexemes.length && lexemes[p].type === TokenType.Operator) {
            const operator = lexemes[p].value;
            p++;

            // Get the right-hand side value of the unary operator
            const result = this.Parse(lexemes, p);
            p = result.newPosition;

            // Create unary expression
            const value = new UnaryExpression(operator, result.value);
            return { value, newPosition: p };
        }

        throw new Error(`Invalid unary expression at position ${position}: ${lexemes[position].value}`);
    }

    private static ParseIdentifier(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        // Check for column reference pattern ([identifier dot] * n + identifier)
        let p = position;
        const identifiers: string[] = [];

        // Add the first identifier
        identifiers.push(lexemes[p].value);
        p++;

        // Look for dot and identifier pattern
        while (
            p < lexemes.length &&
            p + 1 < lexemes.length &&
            lexemes[p].type === TokenType.Dot &&
            lexemes[p + 1].type === TokenType.Identifier
        ) {
            // Skip the dot and add the next identifier
            p++;
            identifiers.push(lexemes[p].value);
            p++;
        }

        if (identifiers.length > 1) {
            // If there are multiple identifiers, treat it as a column reference
            const lastIdentifier = identifiers.pop() || '';
            const value = new ColumnReference(identifiers, lastIdentifier);
            return { value, newPosition: p };
        } else {
            // If there is a single identifier, treat it as a simple identifier
            const value = new ColumnReference(null, identifiers[0]);
            return { value, newPosition: p };
        }
    }

    private static ParseArrayExpression(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let p = position;
        // Array function is enclosed in []
        const arg = this.ParseBracket(lexemes, p);
        p = arg.newPosition;
        const value = new ArrayExpression(arg.value);
        return { value, newPosition: p };
    }

    private static ParseFunctionCall(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let p = position;

        // Get function name
        const result = lexemes[p];
        const functionName = result.value;
        p++;

        if (p < lexemes.length && lexemes[p].type === TokenType.OpenParen) {
            // General argument parsing
            const arg = this.ParseParen(lexemes, p);
            p = arg.newPosition;
            const value = new FunctionCall(functionName, arg.value);
            return { value, newPosition: p };
        } else {
            throw new Error(`Expected opening parenthesis after function name '${functionName}' at position ${p}`);
        }
    }

    private static ParseParenExpression(lexemes: Lexeme[], position: number): { value: ParenExpression; newPosition: number } {
        let p = position;

        const result = this.ParseParen(lexemes, p);
        p = result.newPosition;

        const value = new ParenExpression(result.value);
        return { value, newPosition: p };
    }

    private static ParseParen(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        return this.ParseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, position);
    }

    private static ParseBracket(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        return this.ParseArgument(TokenType.OpenBracket, TokenType.CloseBracket, lexemes, position);
    }

    private static ParseArgument(oepnToken: TokenType, closeToken: TokenType, lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let p = position;
        let args: ValueComponent[] = [];

        // Check for opening parenthesis
        if (p < lexemes.length && lexemes[p].type === oepnToken) {
            p++;

            // Parse the value inside
            const result = this.Parse(lexemes, p);
            p = result.newPosition;
            args.push(result.value);

            // Continue reading if the next element is a comma
            while (p < lexemes.length && lexemes[p].type === TokenType.Comma) {
                p++;
                const argResult = this.Parse(lexemes, p);
                p = argResult.newPosition;
                args.push(argResult.value);
            }

            // Check for closing parenthesis
            if (p < lexemes.length && lexemes[p].type === closeToken) {
                p++;
                if (args.length === 1) {
                    // Return as is if there is only one argument
                    return { value: args[0], newPosition: p };
                }
                // Create ValueCollection if there are multiple arguments
                const value = new ValueCollection(args);
                return { value, newPosition: p };
            } else {
                throw new Error(`Missing closing parenthesis at position ${p}`);
            }
        }

        throw new Error(`Expected opening parenthesis at position ${position}`);
    }
}
