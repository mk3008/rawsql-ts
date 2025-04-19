import { WindowFrameClause } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { WindowExpressionParser } from "./WindowExpressionParser";

export class WindowClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): WindowFrameClause {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The WINDOW clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: WindowFrameClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'window') {
            throw new Error(`Syntax error at position ${idx}: Expected 'WINDOW' keyword but found "${lexemes[idx].value}". WINDOW clauses must start with the WINDOW keyword.`);
        }
        idx++;

        if (idx >= lexemes.length || lexemes[idx].type !== TokenType.Identifier) {
            throw new Error(`Syntax error: Expected window name after 'WINDOW' keyword.`);
        }

        // Get the window name
        const name = lexemes[idx].value;
        idx++;

        if (idx >= lexemes.length || lexemes[idx].value !== 'as') {
            throw new Error(`Syntax error at position ${idx}: Expected 'AS' keyword after window name.`);
        }
        idx++;

        const expr = WindowExpressionParser.parseFromLexeme(lexemes, idx);
        idx = expr.newIndex;

        const windowFrame = new WindowFrameClause(name, expr.value);
        return { value: windowFrame, newIndex: idx };
    }
}