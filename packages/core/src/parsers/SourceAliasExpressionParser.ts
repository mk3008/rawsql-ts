import { SourceAliasExpression } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";


export class SourceAliasExpressionParser {
    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: SourceAliasExpression; newIndex: number; } {
        let idx = index;

        // If there is a column alias, it may be detected as a function, so functions are also processed.
        if (idx < lexemes.length && ((lexemes[idx].type & TokenType.Identifier) || (lexemes[idx].type & TokenType.Function))) {
            // Check for alias and capture comments from the alias token
            const aliasToken = lexemes[idx];
            const table = aliasToken.value;
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

                const sourceAlias = new SourceAliasExpression(table, columns);
                // Transfer positioned comments from the alias token
                if (aliasToken.positionedComments && aliasToken.positionedComments.length > 0) {
                    sourceAlias.positionedComments = aliasToken.positionedComments;
                }
                return { value: sourceAlias, newIndex: idx };
            }

            const sourceAlias = new SourceAliasExpression(table, null);
            // Transfer positioned comments from the alias token
            if (aliasToken.positionedComments && aliasToken.positionedComments.length > 0) {
                sourceAlias.positionedComments = aliasToken.positionedComments;
            }
            return { value: sourceAlias, newIndex: idx };
        }

        throw new Error(`Syntax error at position ${index}: Expected an identifier for table alias but found "${lexemes[index]?.value || 'end of input'}".`);
    }
}
