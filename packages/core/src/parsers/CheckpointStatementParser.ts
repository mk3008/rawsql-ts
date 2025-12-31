import { Lexeme } from '../models/Lexeme';
import { CheckpointStatement } from '../models/DDLStatements';

export class CheckpointStatementParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: CheckpointStatement; newIndex: number } {
        const lexeme = lexemes[index];
        if (!lexeme || lexeme.value.toLowerCase() !== 'checkpoint') {
            throw new Error(`[CheckpointStatementParser] Expected CHECKPOINT at index ${index}.`);
        }

        return {
            value: new CheckpointStatement(),
            newIndex: lexemes.length,
        };
    }
}
