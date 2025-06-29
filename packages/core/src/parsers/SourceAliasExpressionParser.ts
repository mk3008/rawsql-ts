import { SourceAliasExpression } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";


export class SourceAliasExpressionParser {
    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: SourceAliasExpression; newIndex: number; } {
        let idx = index;

        // If there is a column alias, it may be detected as a function, so functions are also processed.
        if (idx < lexemes.length && ((lexemes[idx].type & TokenType.Identifier) || (lexemes[idx].type & TokenType.Function))) {
            // Check for alias
            const table = lexemes[idx].value;
            idx++;

            if (idx < lexemes.length && (lexemes[idx].type & TokenType.OpenParen)) {
                // Check for column alias
                const columns: string[] = [];

                // Skip the open parenthesis
                idx++;

                while (idx < lexemes.length && (lexemes[idx].type & TokenType.Identifier)) {
                    columns.push(lexemes[idx].value);
                    idx++;
                    if (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
                        idx++;
                    } else {
                        break; // Exit loop if not a comma
                    }
                }

                if (lexemes[idx].type & TokenType.CloseParen) {
                    // Skip the closing parenthesis
                    idx++;
                } else {
                    throw new Error(`Syntax error at position ${idx}: Missing closing parenthesis ')' for column alias list. Each opening parenthesis must have a matching closing parenthesis.`);
                }
                if (columns.length === 0) {
                    throw new Error(`Syntax error at position ${index}: No column aliases found. Column alias declarations must contain at least one column name.`);
                }

                return { value: new SourceAliasExpression(table, columns), newIndex: idx };
            }

            return { value: new SourceAliasExpression(table, null), newIndex: idx };
        }

        throw new Error(`Syntax error at position ${index}: Expected an identifier for table alias but found "${lexemes[index]?.value || 'end of input'}".`);
    }
}
