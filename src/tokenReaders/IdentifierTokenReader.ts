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

        // MySQL escaped identifier (escape character is backtick)
        if (char === '`') {
            const identifier = this.readEscapedIdentifier('`');
            return this.createLexeme(TokenType.Identifier, identifier);
        }

        // Postgres escaped identifier (escape character is double quote)
        if (char === '"') {
            const identifier = this.readEscapedIdentifier('"');
            return this.createLexeme(TokenType.Identifier, identifier);
        }

        // SQLServer escaped identifier (escape character is square bracket)
        if (char === '[' && (previous === null || previous.value !== "array")) {
            const identifier = this.readEscapedIdentifier(']');
            return this.createLexeme(TokenType.Identifier, identifier);
        }

        // Regular identifier
        const result = StringUtils.readRegularIdentifier(this.input, this.position);
        this.position = result.newPosition;
        return this.createLexeme(TokenType.Identifier, result.identifier);
    }

    /**
     * Read an escaped identifier (surrounded by delimiters)
     */
    private readEscapedIdentifier(delimiter: string): string {
        const start = this.position;

        // Skip the opening delimiter
        this.position++;

        while (this.canRead()) {
            if (this.input[this.position] === delimiter) {
                break;
            }
            this.position++;
        }

        if (start === this.position) {
            throw new Error(`Closing delimiter is not found. position: ${start}, delimiter: ${delimiter}\n${this.getDebugPositionInfo(start)}}`);
        }

        // Skip the closing delimiter
        this.position++;

        // exclude the delimiter
        return this.input.slice(start + 1, this.position - 1);
    }
}
