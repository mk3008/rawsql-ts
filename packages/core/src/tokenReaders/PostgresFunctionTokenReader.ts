import { Lexeme, TokenType } from '../models/Lexeme';
import { FunctionTokenReader } from './FunctionTokenReader';

export class PostgresFunctionTokenReader extends FunctionTokenReader {
    protected override tryReadDialectSpecificToken(_previous: Lexeme | null): Lexeme | null {
        if (this.input.slice(this.position, this.position + 6).toLowerCase() !== 'array[') {
            return null;
        }

        this.position += 5;
        return this.createLexeme(TokenType.Function, 'array');
    }
}
