import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';
import { CharLookupTable } from '../utils/charLookupTable';

/**
 * Reads SQL parameter tokens (@param, :param, $param, ?)
 */
export class ParameterTokenReader extends BaseTokenReader {
    /**
     * Try to read a parameter token
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        const char = this.input[this.position];

        // named parameter (@param, :param, $param)
        if (CharLookupTable.isNamedParameterPrefix(char)) {

            // However, do not recognize as a parameter if the next character is an operator symbol
            // To avoid postgres `::`
            if (this.canRead(1) && CharLookupTable.isOperatorSymbol(this.input[this.position + 1])) {
                return null;
            }

            this.position++;

            // Read the identifier part after the prefix
            const start = this.position;
            while (this.canRead() && !CharLookupTable.isDelimiter(this.input[this.position])) {
                this.position++;
            }

            const identifier = this.input.slice(start, this.position);
            return this.createLexeme(TokenType.Parameter, char + identifier);
        }

        // nameless parameter (?)
        if (char === '?') {
            this.position++;
            return this.createLexeme(TokenType.Parameter, char);
        }

        return null;
    }
}
