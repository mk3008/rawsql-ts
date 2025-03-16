import { BaseTokenReader } from './BaseTokenReader';
import { TokenType } from '../enums/tokenType';
import { Lexeme } from '../models/Lexeme';
import { CharLookupTable } from '../utils/charLookupTable';
import { KeywordParser } from '../utils/KeywordParser';
import { KeywordTrie } from "../utils/KeywordTrie";

const trie = new KeywordTrie([
    ["is"],
    ["is", "not"],
    ["and"],
    ["or"]
]);

const parser = new KeywordParser(trie);

export class OperatorTokenReader extends BaseTokenReader {
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

        const result = parser.parse(this.input, this.position);
        if (result !== null) {
            this.position = result.newPosition;
            return this.createLexeme(TokenType.Operator, result.keyword);
        }

        return null;
    }
}