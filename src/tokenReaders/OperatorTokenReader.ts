import { BaseTokenReader } from './BaseTokenReader';
import { TokenType } from '../enums/tokenType';
import { Lexeme } from '../models/Lexeme';
import { CharLookupTable } from '../utils/charLookupTable';

export class OperatorTokenReader extends BaseTokenReader {
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        const char = this.input[this.position];

        if (CharLookupTable.isOperator(char)) {
            const start = this.position;
            while (this.canRead() && CharLookupTable.isOperator(this.input[this.position])) {
                this.position++;
            }
            return this.createLexeme(TokenType.Operator, this.input.slice(start, this.position));
        }

        return null;
    }
}