import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference, IdentifierString, UnaryExpression, ValueComponent } from "../models/ValueComponent";
import { ValueParser } from "./ValueParser";

export class UnaryExpressionParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Process unary operator
        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Operator)) {
            const operatorLexeme = lexemes[idx];
            const operator = operatorLexeme.value;
            idx++;

            // Treat the asterisk as an Identifier, not as a unary operator
            if (operator === '*') {
                const v = new ColumnReference(null, '*');
                return { value: v, newIndex: idx };
            }

            // Get the right-hand side value of the unary operator
            const result = ValueParser.parseFromLexeme(lexemes, idx);
            idx = result.newIndex;

            // Create unary expression
            const value = new UnaryExpression(operator, result.value);

            if (operatorLexeme.positionedComments && operatorLexeme.positionedComments.length > 0) {
                // Carry positioned comments from the operator token onto the expression for precise placement
                value.positionedComments = operatorLexeme.positionedComments;
            } else if (operatorLexeme.comments && operatorLexeme.comments.length > 0) {
                // Fallback for legacy comment collection so older paths still retain notes
                value.comments = operatorLexeme.comments;
            }

            return { value, newIndex: idx };
        }

        throw new Error(`Invalid unary expression at index ${index}: ${lexemes[index].value}`);
    }
}