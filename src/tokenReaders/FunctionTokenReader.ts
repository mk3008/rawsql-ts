import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';
import { StringUtils } from '../utils/stringUtils';
import { KeywordTrie } from '../models/KeywordTrie';
import { KeywordParser } from '../parsers/KeywordParser';

const trie = new KeywordTrie([
    ["grouping", "sets"],
]);
const keywordParser = new KeywordParser(trie);

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

        // Check for keyword identifiers
        const keyword = keywordParser.parse(this.input, this.position);
        if (keyword !== null) {
            this.position = keyword.newPosition;
            return this.createLexeme(TokenType.Function, keyword.keyword);
        }

        // Regular identifier
        const result = StringUtils.tryReadRegularIdentifier(this.input, this.position);
        if (!result) {
            return null;
        }
        this.position = result.newPosition;

        // peek next token 
        var shift = StringUtils.readWhiteSpaceAndComment(this.input, this.position).position - this.position;

        if (this.canRead(shift) && this.input[this.position + shift] === '(') {
            return this.createLexeme(TokenType.Function, result.identifier);
        }
        return null;
    }
}
