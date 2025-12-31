import { Lexeme } from '../models/Lexeme';
import { ReindexStatement } from '../models/DDLStatements';

export class ReindexStatementParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ReindexStatement; newIndex: number } {
        const lexeme = lexemes[index];
        if (!lexeme || lexeme.value.toLowerCase() !== 'reindex') {
            throw new Error(`[ReindexStatementParser] Expected REINDEX at index ${index}.`);
        }

        return {
            value: new ReindexStatement(),
            newIndex: lexemes.length,
        };
    }
}
