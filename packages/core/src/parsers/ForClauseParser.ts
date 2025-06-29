import { ForClause, LockMode } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";

export class ForClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): ForClause {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The FOR clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ForClause; newIndex: number } {
        let idx = index;

        // Check for FOR keyword
        if (lexemes[idx].value.toLowerCase() !== 'for') {
            throw new Error(`Syntax error at position ${idx}: Expected 'FOR' keyword but found "${lexemes[idx].value}". FOR clauses must start with the FOR keyword.`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'FOR' keyword. The FOR clause requires a lock mode specification.`);
        }

        // Parse lock mode
        const lockModeValue = lexemes[idx].value;
        let lockMode: LockMode;

        switch (lockModeValue) {
            case 'update':
                lockMode = LockMode.Update;
                idx++;
                break;
            case 'share':
                lockMode = LockMode.Share;
                idx++;
                break;
            case 'key share':
                lockMode = LockMode.KeyShare;
                idx++;
                break;
            case 'no key update':
                lockMode = LockMode.NokeyUpdate;
                idx++;
                break;
            default:
                throw new Error(`Syntax error at position ${idx}: Invalid lock mode "${lockModeValue}". Valid lock modes are: UPDATE, SHARE, KEY SHARE, NO KEY UPDATE.`);
        }

        const clause = new ForClause(lockMode);
        return { value: clause, newIndex: idx };
    }
}