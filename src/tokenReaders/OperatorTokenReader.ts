import { BaseTokenReader } from './BaseTokenReader';
import { TokenType } from '../enums/tokenType';
import { Lexeme } from '../models/Lexeme';
import { CharLookupTable } from '../utils/charLookupTable';
import { StringUtils } from '../utils/stringUtils';
import { KeywordMatchResult, KeywordTrie, KeywordTrieReader } from '../utils/KeywordTrie';

export class OperatorTokenReader extends BaseTokenReader {

    private trie = new KeywordTrie([
        ["is"],
        ["is", "not"],
        ["and"],
        ["or"]
    ]);

    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        const char = this.input[this.position];

        if (CharLookupTable.isOperatorSymbol(char)) {
            const start = this.position;
            while (this.canRead() && CharLookupTable.isOperatorSymbol(this.input[this.position])) {
                this.position++;
            }
            return this.createLexeme(TokenType.Operator, this.input.slice(start, this.position));
        }

        // Logical operators
        const reader = new KeywordTrieReader(this.input, this.position, this.trie);
        const result = reader.readKeyword();
        if (result !== null) {
            this.position = result.newPosition;
            return this.createLexeme(TokenType.Operator, result.keyword);
        }

        return null;
    }
}