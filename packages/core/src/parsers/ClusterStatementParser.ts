import { Lexeme } from '../models/Lexeme';
import { ClusterStatement } from '../models/DDLStatements';

export class ClusterStatementParser {
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ClusterStatement; newIndex: number } {
        const lexeme = lexemes[index];
        if (!lexeme || lexeme.value.toLowerCase() !== 'cluster') {
            throw new Error(`[ClusterStatementParser] Expected CLUSTER at index ${index}.`);
        }

        return {
            value: new ClusterStatement(),
            newIndex: lexemes.length,
        };
    }
}
