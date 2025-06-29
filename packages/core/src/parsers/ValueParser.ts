import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference, TypeValue, UnaryExpression, ValueComponent, ValueList, BinaryExpression, CastExpression } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { IdentifierParser } from "./IdentifierParser";
import { LiteralParser } from "./LiteralParser";
import { ParenExpressionParser } from "./ParenExpressionParser";
import { UnaryExpressionParser } from "./UnaryExpressionParser";
import { ParameterExpressionParser } from "./ParameterExpressionParser";
import { StringSpecifierExpressionParser } from "./StringSpecifierExpressionParser";
import { CommandExpressionParser } from "./CommandExpressionParser";
import { FunctionExpressionParser } from "./FunctionExpressionParser";
import { FullNameParser } from "./FullNameParser";
import { ParseError } from "./ParseError";
import { OperatorPrecedence } from "../utils/OperatorPrecedence";

export class ValueParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): ValueComponent {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw ParseError.fromUnparsedLexemes(
                lexemes,
                result.newIndex,
                `[ValueParser]`
            );
        }

        return result.value;
    }

    /**
     * Parse from lexeme array with logical operator controls
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number, allowAndOperator: boolean = true, allowOrOperator: boolean = true): { value: ValueComponent; newIndex: number } {
        return this.parseExpressionWithPrecedence(lexemes, index, 0, allowAndOperator, allowOrOperator);
    }

    /**
     * Parse expressions with operator precedence handling
     * Uses precedence climbing algorithm
     */
    private static parseExpressionWithPrecedence(
        lexemes: Lexeme[],
        index: number,
        minPrecedence: number,
        allowAndOperator: boolean = true,
        allowOrOperator: boolean = true
    ): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Parse the primary expression (left side)
        const comment = lexemes[idx].comments;
        const left = this.parseItem(lexemes, idx);
        left.value.comments = comment;
        idx = left.newIndex;

        let result = left.value;

        // Process operators with precedence
        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Operator)) {
            const operatorToken = lexemes[idx];
            const operator = operatorToken.value;

            // Check if this operator is allowed
            if (!allowAndOperator && operator.toLowerCase() === "and") {
                break;
            }
            if (!allowOrOperator && operator.toLowerCase() === "or") {
                break;
            }

            // Get operator precedence
            const precedence = OperatorPrecedence.getPrecedence(operator);

            // If this operator has lower precedence than minimum, stop
            if (precedence < minPrecedence) {
                break;
            }

            idx++; // consume operator            // Handle BETWEEN specially as it has different syntax
            if (OperatorPrecedence.isBetweenOperator(operator)) {
                const betweenResult = FunctionExpressionParser.parseBetweenExpression(
                    lexemes, idx, result, operator.toLowerCase().includes('not')
                );
                result = betweenResult.value;
                idx = betweenResult.newIndex;
                continue;
            }

            // Handle :: (cast) operator specially
            if (operator === "::") {
                const typeValue = FunctionExpressionParser.parseTypeValue(lexemes, idx);
                result = new CastExpression(result, typeValue.value);
                idx = typeValue.newIndex;
                continue;
            }

            // For left-associative operators, use precedence + 1
            const nextMinPrecedence = precedence + 1;

            // Parse the right-hand side with higher precedence
            const rightResult = this.parseExpressionWithPrecedence(
                lexemes, idx, nextMinPrecedence, allowAndOperator, allowOrOperator
            );
            idx = rightResult.newIndex;

            // Create binary expression directly
            result = new BinaryExpression(result, operator, rightResult.value);
        }

        return { value: result, newIndex: idx };
    }

    private static parseItem(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Range check
        if (idx >= lexemes.length) {
            throw new Error(`Unexpected end of lexemes at index ${index}`);
        }

        const current = lexemes[idx];

        if (current.type & TokenType.Identifier && current.type & TokenType.Operator && current.type & TokenType.Type) {
            // Check if this is followed by parentheses (function call)
            if (idx + 1 < lexemes.length && (lexemes[idx + 1].type & TokenType.OpenParen)) {
                // Determine if this is a type constructor or function call
                if (this.isTypeConstructor(lexemes, idx + 1, current.value)) {
                    // Type constructor
                    const typeValue = FunctionExpressionParser.parseTypeValue(lexemes, idx);
                    return { value: typeValue.value, newIndex: typeValue.newIndex };
                } else {
                    // Function call
                    return FunctionExpressionParser.parseFromLexeme(lexemes, idx);
                }
            }
            // Typed literal format pattern
            // e.g., `interval '2 days'`
            const first = IdentifierParser.parseFromLexeme(lexemes, idx);
            if (first.newIndex >= lexemes.length) {
                return first;
            }
            const next = lexemes[first.newIndex];
            if (next.type & TokenType.Literal) {
                // Typed literal format
                const second = LiteralParser.parseFromLexeme(lexemes, first.newIndex);
                const result = new UnaryExpression(lexemes[idx].value, second.value);
                return { value: result, newIndex: second.newIndex };
            }
            return first;
        } else if (current.type & TokenType.Identifier) {
            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            // Namespace is also recognized as Identifier.
            // Since functions and types, as well as columns (tables), can have namespaces,
            // it is necessary to determine by the last element of the identifier.
            if (lexemes[newIndex - 1].type & TokenType.Function) {
                return FunctionExpressionParser.parseFromLexeme(lexemes, idx);
            } else if (lexemes[newIndex - 1].type & TokenType.Type) {
                // Handle Type tokens that also have Identifier flag
                if (newIndex < lexemes.length && (lexemes[newIndex].type & TokenType.OpenParen)) {
                    // Determine if this is a type constructor or function call
                    if (this.isTypeConstructor(lexemes, newIndex, name.name)) {
                        // Type constructor (NUMERIC(10,2), VARCHAR(50), etc.)
                        const typeValue = FunctionExpressionParser.parseTypeValue(lexemes, idx);
                        return { value: typeValue.value, newIndex: typeValue.newIndex };
                    } else {
                        // Function call (DATE('2025-01-01'), etc.)
                        return FunctionExpressionParser.parseFromLexeme(lexemes, idx);
                    }
                } else {
                    // Handle standalone type tokens
                    const value = new TypeValue(namespaces, name);
                    return { value, newIndex };
                }
            }
            const value = new ColumnReference(namespaces, name);
            return { value, newIndex };
        } else if (current.type & TokenType.Literal) {
            return LiteralParser.parseFromLexeme(lexemes, idx);
        } else if (current.type & TokenType.OpenParen) {
            return ParenExpressionParser.parseFromLexeme(lexemes, idx);
        } else if (current.type & TokenType.Function) {
            return FunctionExpressionParser.parseFromLexeme(lexemes, idx);
        } else if (current.type & TokenType.Operator) {
            return UnaryExpressionParser.parseFromLexeme(lexemes, idx);
        } else if (current.type & TokenType.Parameter) {
            return ParameterExpressionParser.parseFromLexeme(lexemes, idx);
        } else if (current.type & TokenType.StringSpecifier) {
            return StringSpecifierExpressionParser.parseFromLexeme(lexemes, idx);
        } else if (current.type & TokenType.Command) {
            return CommandExpressionParser.parseFromLexeme(lexemes, idx);
        } else if (current.type & TokenType.OpenBracket) {
            // SQLServer escape identifier format. e.g. [dbo] or [dbo].[table]
            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            const value = new ColumnReference(namespaces, name);
            return { value, newIndex };
        } else if (current.type & TokenType.Type) {
            // Check if this type token is followed by an opening parenthesis
            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            if (newIndex < lexemes.length && (lexemes[newIndex].type & TokenType.OpenParen)) {
                // Determine if this is a type constructor or function call
                if (this.isTypeConstructor(lexemes, newIndex, name.name)) {
                    // Type constructor (NUMERIC(10,2), VARCHAR(50), etc.)
                    const typeValue = FunctionExpressionParser.parseTypeValue(lexemes, idx);
                    return { value: typeValue.value, newIndex: typeValue.newIndex };
                } else {
                    // Function call (DATE('2025-01-01'), etc.)
                    return FunctionExpressionParser.parseFromLexeme(lexemes, idx);
                }
            } else {
                // Handle standalone type tokens
                const value = new TypeValue(namespaces, name);
                return { value, newIndex };
            }
        }

        throw new Error(`[ValueParser] Invalid lexeme. index: ${idx}, type: ${lexemes[idx].type}, value: ${lexemes[idx].value}`);
    }

    public static parseArgument(openToken: TokenType, closeToken: TokenType, lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        const args: ValueComponent[] = [];

        // Check for opening parenthesis
        if (idx < lexemes.length && lexemes[idx].type === openToken) {
            idx++;

            if (idx < lexemes.length && lexemes[idx].type === closeToken) {
                // If there are no arguments, return an empty ValueList
                idx++;
                return { value: new ValueList([]), newIndex: idx };
            }

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
            const result = this.parseFromLexeme(lexemes, idx);
            idx = result.newIndex;
            args.push(result.value);

            // Continue reading if the next element is a comma
            while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
                idx++;
                const argResult = this.parseFromLexeme(lexemes, idx);
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

    /**
     * Determines if a type token followed by parentheses is a type constructor or function call
     * @param lexemes Array of lexemes
     * @param openParenIndex Index of the opening parenthesis
     * @param typeName Name of the type/function
     * @returns True if this is a type constructor, false if it's a function call
     */
    private static isTypeConstructor(lexemes: Lexeme[], openParenIndex: number, typeName: string): boolean {
        // These are always type constructors regardless of content
        const alwaysTypeConstructors = [
            'NUMERIC', 'DECIMAL', 'VARCHAR', 'CHAR', 'CHARACTER',
            'TIMESTAMP', 'TIME', 'INTERVAL'
        ];
        
        const upperTypeName = typeName.toUpperCase();
        if (alwaysTypeConstructors.includes(upperTypeName)) {
            return true;
        }
        
        // For DATE, check if the first argument is a string literal (function) or not (type)
        if (upperTypeName === 'DATE') {
            const firstArgIndex = openParenIndex + 1;
            if (firstArgIndex < lexemes.length) {
                const firstArg = lexemes[firstArgIndex];
                const isStringLiteral = (firstArg.type & TokenType.Literal) && 
                                       typeof firstArg.value === 'string' &&
                                       isNaN(Number(firstArg.value));
                // If first argument is a string literal, it's a function call
                // DATE('2025-01-01') -> function
                // DATE(6) -> type constructor
                return !isStringLiteral;
            }
        }
        
        // Default: assume it's a function call for ambiguous cases
        return false;
    }
}
