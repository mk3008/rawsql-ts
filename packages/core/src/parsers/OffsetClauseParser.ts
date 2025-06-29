import { OffsetClause } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class OffsetClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): OffsetClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The OFFSET clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: OffsetClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'offset') {
            throw new Error(`Syntax error at position ${idx}: Expected 'OFFSET' keyword but found "${lexemes[idx].value}". OFFSET clauses must start with the OFFSET keyword.`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'OFFSET' keyword. The OFFSET clause requires a numeric expression.`);
        }

        // Parse OFFSET value
        const offsetItem = ValueParser.parseFromLexeme(lexemes, idx);
        idx = offsetItem.newIndex;

        // If there is a "row" or "rows" command, skip it
        if (idx < lexemes.length && (lexemes[idx].value === 'row' || lexemes[idx].value === 'rows')) {
            idx++;
        }

        const clause = new OffsetClause(offsetItem.value);

        return { value: clause, newIndex: idx };
    }
}
