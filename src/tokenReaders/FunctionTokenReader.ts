import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';
import { StringUtils } from '../utils/stringUtils';

/**
 * Reads SQL identifier tokens
 */
export class FunctionTokenReader extends BaseTokenReader {
    /**
     * Try to read an identifier token
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        // Regular identifier
        const result = StringUtils.readRegularIdentifier(this.input, this.position);
        this.position = result.newPosition;

        // peek next token 
        var shift = StringUtils.readComments(this.input, this.position).position - this.position;

        if (this.canRead(shift) && this.input[this.position + shift] === '(') {
            return this.createLexeme(TokenType.Function, result.identifier);
        }
        return null;
    }
}
