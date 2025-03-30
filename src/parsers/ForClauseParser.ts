import { ForClause, LockMode } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";

export class ForClauseParser {
    public static parseFromText(query: string): ForClause {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();

        // Parse
        const result = this.parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Unexpected token at position ${result.newIndex}: ${lexemes[result.newIndex].value}`);
        }

        return result.value;
    }

    private static parse(lexemes: Lexeme[], index: number): { value: ForClause; newIndex: number } {
        let idx = index;

        // Check for FOR keyword
        if (lexemes[idx].value.toLowerCase() !== 'for') {
            throw new Error(`Expected 'FOR' at index ${idx}`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Expected lock mode after FOR keyword`);
        }

        // ロックモードの解析
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
                throw new Error(`Invalid lock mode: ${lockModeValue}`);
        }

        const clause = new ForClause(lockMode);
        return { value: clause, newIndex: idx };
    }
}