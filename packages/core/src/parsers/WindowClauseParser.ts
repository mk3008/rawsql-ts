import { WindowFrameClause, WindowsClause } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { WindowExpressionParser } from "./WindowExpressionParser";

export class WindowClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): WindowsClause {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The WINDOW clause is complete but there are additional tokens.`);
        }
        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: WindowsClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'window') {
            throw new Error(`Syntax error at position ${idx}: Expected 'WINDOW' keyword but found "${lexemes[idx].value}". WINDOW clauses must start with the WINDOW keyword.`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'WINDOW' keyword. The WINDOW clause requires at least one window definition.`);
        }

        const windows: WindowFrameClause[] = [];
        while (idx < lexemes.length) {

            if (idx >= lexemes.length || lexemes[idx].type !== TokenType.Identifier) {
                throw new Error(`Syntax error: Expected window name after 'WINDOW' keyword.`);
            }
            const name = lexemes[idx].value;
            idx++;
            if (idx >= lexemes.length || lexemes[idx].value !== 'as') {
                throw new Error(`Syntax error at position ${idx}: Expected 'AS' keyword after window name.`);
            }
            idx++;
            const expr = WindowExpressionParser.parseFromLexeme(lexemes, idx);
            idx = expr.newIndex;
            windows.push(new WindowFrameClause(name, expr.value));

            if (idx < lexemes.length && lexemes[idx].type & TokenType.Comma) {
                idx++;
            } else {
                break;
            }
        }

        if (windows.length === 0) {
            throw new Error('At least one WINDOW clause is required after WINDOW keyword.');
        }
        return { value: new WindowsClause(windows), newIndex: idx };
    }
}