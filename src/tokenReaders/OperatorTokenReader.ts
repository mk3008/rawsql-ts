import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';
import { CharLookupTable } from '../utils/charLookupTable';
import { KeywordParser } from '../KeywordParser';
import { KeywordTrie } from '../models/KeywordTrie';

const trie = new KeywordTrie([
    ["not"],
    ["is"],
    ["is", "not"],
    ["and"],
    ["or"],
    ["like"],
    ["not", "like"],
    ["in"],
    ["not", "in"],
    ["exists"],
    ["not", "exists"],
    ["is", "distinct", "from"],
    ["is", "not", "distinct", "from"],
    ["between"],
    ["not", "between"],
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