import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';
import { StringUtils } from '../utils/stringUtils';

/**
 * Reads SQL identifier tokens
 */
export class IdentifierTokenReader extends BaseTokenReader {
    /**
     * Try to read an identifier token
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        const char = this.input[this.position];

        // wildcard identifier
        if (char === '*') {
            // Assume that the OperatorTokenReader is executed before the IdentifierTokenReader.
            // Since we have determined that the OperatorTokenReader is not an Operator,
            // we treat '*' here as a wildcard identifier.
            this.position++;
            return this.createLexeme(TokenType.Identifier, char);
        }

        // Regular identifier
        const result = StringUtils.readRegularIdentifier(this.input, this.position);
        this.position = result.newPosition;
        return this.createLexeme(TokenType.Identifier, result.identifier);
    }
}
