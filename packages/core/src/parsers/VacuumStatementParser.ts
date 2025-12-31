import { Lexeme } from '../models/Lexeme';
import { VacuumStatement } from '../models/DDLStatements';

export class VacuumStatementParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: VacuumStatement; newIndex: number } {
        const lexeme = lexemes[index];
        if (!lexeme || lexeme.value.toLowerCase() !== 'vacuum') {
            throw new Error(`[VacuumStatementParser] Expected VACUUM at index ${index}.`);
        }

        return {
            value: new VacuumStatement(),
            newIndex: lexemes.length,
        };
    }
}
