import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';
import { StringUtils } from '../utils/stringUtils';
import { KeywordTrie } from '../models/KeywordTrie';
import { KeywordParser } from '../parsers/KeywordParser';

// Use KeywordTrie to identify type names composed of multiple words.
const trie = new KeywordTrie([
    // type
    ["double", "precision"],
    ["character", "varying"],
    ["time", "without", "time", "zone"],
    ["time", "with", "time", "zone"],
    ["timestamp", "without", "time", "zone"],
    ["timestamp", "with", "time", "zone"],
]);
const typeParser = new KeywordParser(trie);

/**
 * Reads SQL identifier tokens
 */
export class TypeTokenReader extends BaseTokenReader {
    /**
     * Try to read an identifier token
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        // Check for keyword identifiers
        const keyword = typeParser.parse(this.input, this.position);
        if (keyword !== null) {
            this.position = keyword.newPosition;
            return this.createLexeme(TokenType.Type, keyword.keyword);
        }

        // check pervious token
        if (previous === null) {
            return null;
        }

        const result = StringUtils.tryReadRegularIdentifier(this.input, this.position);
        if (!result) {
            return null;
        }
        this.position = result.newPosition;

        // type cast command
        if (previous.type & TokenType.Command && previous.value === "as") {
            // If the previous token is the `as` keyword, it could be a type cast or an identifier
            return this.createLexeme(TokenType.Identifier | TokenType.Type, result.identifier);
        }

        // postgres type conversion
        if (previous.type & TokenType.Operator && previous.value === "::") {
            return this.createLexeme(TokenType.Type, result.identifier);
        }

        return null;
    }
}
