import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference, ValueComponent, LiteralValue, BinaryExpression, ParenExpression, FunctionCall, ValueCollection, UnaryExpression, ParameterExpression, ArrayExpression, CaseExpression, SwitchCaseArgument, CaseKeyValuePair as CaseConditionValuePair, BetweenExpression } from "../models/ValueComponent";
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

    public static Parse(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        const result = this.ParseItem(lexemes, position);
        let newPosition = result.newPosition;

        // If the next element is an operator, process it as a binary expression
        if (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.Operator) {
            const operator = lexemes[newPosition].value;
            newPosition++;

            // between
            if (operator === "between") {
                return this.ParseBetweenExpression(lexemes, newPosition, result.value, false);
            } else if (operator === "not between") {
                return this.ParseBetweenExpression(lexemes, newPosition, result.value, true);
            }

            // Get the right-hand side value
            const rightResult = this.Parse(lexemes, newPosition);
            newPosition = rightResult.newPosition;

            // Create binary expression
            const value = new BinaryExpression(result.value, operator, rightResult.value);
            return { value, newPosition };
        }

        return { value: result.value, newPosition };
    }

    static ParseBetweenExpression(lexemes: Lexeme[], newPosition: number, value: ValueComponent, negated: boolean): { value: ValueComponent; newPosition: number; } {
        const lower = this.Parse(lexemes, newPosition);
        newPosition = lower.newPosition;

        if (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.Operator && lexemes[newPosition].command !== "and") {
            throw new Error(`Expected 'and' after 'between' at position ${newPosition}`);
        }

        const upper = this.Parse(lexemes, newPosition);
        newPosition = upper.newPosition;
        const result = new BetweenExpression(value, lower.value, upper.value, negated);
        return { value: result, newPosition };
    }

    private static ParseItem(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let newPosition = position;

        // Range check
        if (newPosition >= lexemes.length) {
            throw new Error(`Unexpected end of lexemes at position ${position}`);
        }

        if (lexemes[newPosition].type === TokenType.Identifier) {
            return this.ParseIdentifier(lexemes, newPosition);
        } else if (lexemes[newPosition].type === TokenType.Literal) {
            return this.ParseLiteralValue(lexemes, newPosition);
        } else if (lexemes[newPosition].type === TokenType.OpenParen) {
            return this.ParseParenExpression(lexemes, newPosition);
        } else if (lexemes[newPosition].type === TokenType.Function) {
            return this.ParseFunctionCall(lexemes, newPosition);
        } else if (lexemes[newPosition].type === TokenType.Operator) {
            return this.ParseUnaryExpression(lexemes, newPosition);
        } else if (lexemes[newPosition].type === TokenType.Parameter) {
            return this.ParseParameterExpression(lexemes, newPosition);
        }
        else if (lexemes[newPosition].type === TokenType.Command) {
            const command = lexemes[newPosition];
            newPosition++;
            if (command.command === "case") {
                return this.ParseCaseExpression(lexemes, newPosition);
            } else if (command.command === "case when") {
                return this.ParseCaseWhenExpression(lexemes, newPosition);
            } else if (command.command === "array") {
                return this.ParseArrayExpression(lexemes, newPosition);
            }
        }

        throw new Error(`Invalid lexeme. position: ${position}, type: ${lexemes[position].type}, value: ${lexemes[position].value}`);
    }

    static ParseCaseExpression(lexemes: Lexeme[], newPosition: number): { value: ValueComponent; newPosition: number; } {
        const condition = this.Parse(lexemes, newPosition);
        newPosition = condition.newPosition;

        const switchCaseResult = this.ParseSwitchCaseArgument(lexemes, newPosition, []);
        newPosition = switchCaseResult.newPosition;

        // Create CASE expression
        const result = new CaseExpression(condition.value, switchCaseResult.value);
        return { value: result, newPosition };
    }

    static ParseCaseWhenExpression(lexemes: Lexeme[], newPosition: number): { value: ValueComponent; newPosition: number; } {
        const casewhenResult = this.ParseCaseConditionValuePair(lexemes, newPosition);
        newPosition = casewhenResult.newPosition;

        const caseWhenList: CaseConditionValuePair[] = [casewhenResult.value];
        const switchCaseResult = this.ParseSwitchCaseArgument(lexemes, newPosition, caseWhenList);
        newPosition = switchCaseResult.newPosition;

        // Create CASE WHEN expression
        const result = new CaseExpression(null, switchCaseResult.value);
        return { value: result, newPosition };
    }

    // ParseSwitchCaseArgument method processes the WHEN, ELSE, and END clauses of a CASE expression.
    static ParseSwitchCaseArgument(
        lexemes: Lexeme[],
        position: number,
        initialWhenThenList: CaseConditionValuePair[]
    ): { value: SwitchCaseArgument; newPosition: number; } {
        let newPosition = position;
        const whenThenList = [...initialWhenThenList];
        let elseValue: ValueComponent | null = null;

        // Process WHEN clauses
        while (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.Command && lexemes[newPosition].command === "when") {
            newPosition++;
            const whenResult = this.ParseCaseConditionValuePair(lexemes, newPosition);
            newPosition = whenResult.newPosition;
            whenThenList.push(whenResult.value);
        }

        // Process ELSE
        if (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.Command && lexemes[newPosition].command === "else") {
            newPosition++;
            const elseResult = this.Parse(lexemes, newPosition);
            elseValue = elseResult.value;
            newPosition = elseResult.newPosition;
        }

        // Process END
        if (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.Command && lexemes[newPosition].command === "end") {
            newPosition++;
        } else {
            throw new Error(`Expected 'end' after CASE at position ${newPosition}`);
        }

        if (whenThenList.length === 0) {
            throw new Error(`CASE expression requires at least one WHEN clause at position ${newPosition}`);
        }

        // Create SwitchCaseArgument
        const value = new SwitchCaseArgument(whenThenList, elseValue);
        return { value, newPosition };
    }

    static ParseCaseConditionValuePair(lexemes: Lexeme[], newPosition: number): { value: CaseConditionValuePair; newPosition: number; } {
        const condition = this.Parse(lexemes, newPosition);
        newPosition = condition.newPosition;

        if (newPosition >= lexemes.length || lexemes[newPosition].type !== TokenType.Command || lexemes[newPosition].command !== "then") {
            throw new Error(`Expected 'then' after 'case when' at position ${newPosition}`);
        }
        newPosition++;
        const value = this.Parse(lexemes, newPosition);

        const result = new CaseConditionValuePair(condition.value, value.value);
        newPosition = value.newPosition;
        return { value: result, newPosition };
    }

    private static ParseParameterExpression(lexemes: Lexeme[], newPosition: number): { value: ValueComponent; newPosition: number; } {
        // Exclude the parameter symbol (first character)
        const value = new ParameterExpression(lexemes[newPosition].value.slice(1));
        newPosition++;
        return { value, newPosition };
    }

    private static ParseLiteralValue(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        // Process literal value
        const valueText = lexemes[position].value;
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

        const value = new LiteralValue(parsedValue);
        return { value, newPosition: position + 1 };
    }

    private static ParseUnaryExpression(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let newPosition = position;

        // Process unary operator
        if (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.Operator) {
            const operator = lexemes[newPosition].value;
            newPosition++;

            // Get the right-hand side value of the unary operator
            const result = this.Parse(lexemes, newPosition);
            newPosition = result.newPosition;

            // Create unary expression
            const value = new UnaryExpression(operator, result.value);
            return { value, newPosition };
        }

        throw new Error(`Invalid unary expression at position ${position}: ${lexemes[position].value}`);
    }

    private static ParseIdentifier(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        // Check for column reference pattern ([identifier dot] * n + identifier)
        const identifiers: string[] = [];
        let newPosition = position;

        // Add the first identifier
        identifiers.push(lexemes[newPosition].value);
        newPosition++;

        // Look for dot and identifier pattern
        while (
            newPosition < lexemes.length &&
            newPosition + 1 < lexemes.length &&
            lexemes[newPosition].type === TokenType.Dot &&
            lexemes[newPosition + 1].type === TokenType.Identifier
        ) {
            // Skip the dot and add the next identifier
            newPosition++;
            identifiers.push(lexemes[newPosition].value);
            newPosition++;
        }

        if (identifiers.length > 1) {
            // If there are multiple identifiers, treat it as a column reference
            const lastIdentifier = identifiers.pop() || '';
            const value = new ColumnReference(identifiers, lastIdentifier);
            return { value, newPosition: newPosition };
        } else {
            // If there is a single identifier, treat it as a simple identifier
            const value = new ColumnReference(null, identifiers[0]);
            return { value, newPosition };
        }
    }

    private static ParseArrayExpression(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let newPosition = position;
        // Array function is enclosed in []
        const arg = this.ParseBracket(lexemes, newPosition);
        newPosition = arg.newPosition;
        const value = new ArrayExpression(arg.value);
        return { value, newPosition };
    }

    private static ParseFunctionCall(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let newPosition = position;

        // Get function name
        const result = lexemes[newPosition];
        const functionName = result.value;
        newPosition++;

        if (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.OpenParen) {
            // General argument parsing
            const arg = this.ParseParen(lexemes, newPosition);
            newPosition = arg.newPosition;
            const value = new FunctionCall(functionName, arg.value);
            return { value, newPosition };
        } else {
            throw new Error(`Expected opening parenthesis after function name '${functionName}' at position ${newPosition}`);
        }
    }

    private static ParseParenExpression(lexemes: Lexeme[], position: number): { value: ParenExpression; newPosition: number } {
        const result = this.ParseParen(lexemes, position);
        const value = new ParenExpression(result.value);
        return { value, newPosition: result.newPosition };
    }

    private static ParseParen(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        return this.ParseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, position);
    }

    private static ParseBracket(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        return this.ParseArgument(TokenType.OpenBracket, TokenType.CloseBracket, lexemes, position);
    }

    private static ParseArgument(oepnToken: TokenType, closeToken: TokenType, lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let newPosition = position;
        let args: ValueComponent[] = [];

        // Check for opening parenthesis
        if (newPosition < lexemes.length && lexemes[newPosition].type === oepnToken) {
            newPosition++;

            // Parse the value inside
            const result = this.Parse(lexemes, newPosition);
            newPosition = result.newPosition;
            args.push(result.value);

            // Continue reading if the next element is a comma
            while (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.Comma) {
                newPosition++;
                const argResult = this.Parse(lexemes, newPosition);
                newPosition = argResult.newPosition;
                args.push(argResult.value);
            }

            // Check for closing parenthesis
            if (newPosition < lexemes.length && lexemes[newPosition].type === closeToken) {
                newPosition++;
                if (args.length === 1) {
                    // Return as is if there is only one argument
                    return { value: args[0], newPosition };
                }
                // Create ValueCollection if there are multiple arguments
                const value = new ValueCollection(args);
                return { value, newPosition };
            } else {
                throw new Error(`Missing closing parenthesis at position ${newPosition}`);
            }
        }

        throw new Error(`Expected opening parenthesis at position ${position}`);
    }
}
