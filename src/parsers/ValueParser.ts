import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference, LiteralValue, UnaryExpression, ValueComponent, ValueList } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { IdentifierParser } from "./IdentifierParser";
import { LiteralParser } from "./LiteralParser";
import { ParenExpressionParser } from "./ParenExpressionParser";
import { UnaryExpressionParser } from "./UnaryExpressionParser";
import { ParameterExpressionParser } from "./ParameterExpressionParser";
import { StringSpecifierExpressionParser } from "./StringSpecifierExpressionParser";
import { CommandExpressionParser } from "./CommandExpressionParser";
import { FunctionExpressionParser } from "./FunctionExpressionParser";
import { parseEscapedOrDotSeparatedIdentifiers } from "../utils/parseEscapedOrDotSeparatedIdentifiers";
import { extractNamespacesAndName } from "../utils/extractNamespacesAndName";
import { FullNameParser } from "./FullNameParser";

export class ValueParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): ValueComponent {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`[ValueParser] Unexpected token at index ${result.newIndex}: ${lexemes[result.newIndex].value}`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number, allowAndOperator: boolean = true): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // support comments
        const comment = lexemes[idx].comments;
        const left = this.parseItem(lexemes, idx);
        left.value.comments = comment;
        idx = left.newIndex;

        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Operator)) {
            const binaryResult = FunctionExpressionParser.tryParseBinaryExpression(lexemes, idx, left.value, allowAndOperator);
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

    private static parseItem(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Range check
        if (idx >= lexemes.length) {
            throw new Error(`Unexpected end of lexemes at index ${index}`);
        }

        const current = lexemes[idx];

        if (current.type & TokenType.Identifier && current.type & TokenType.Operator && current.type & TokenType.Type) {
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
            const { namespaces, name, newIndex } = FullNameParser.parse(lexemes, idx);
            // In the case of an identifier, 
            // there is a possibility that it represents a function with a specified namespace.
            if (lexemes[newIndex - 1].type & TokenType.Function) {
                return FunctionExpressionParser.parseFromLexeme(lexemes, idx);
            }
            return IdentifierParser.parseFromLexeme(lexemes, idx);
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
            const { namespaces, name, newIndex } = FullNameParser.parse(lexemes, idx);
            const value = new ColumnReference(namespaces, name);
            return { value, newIndex };
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
}
