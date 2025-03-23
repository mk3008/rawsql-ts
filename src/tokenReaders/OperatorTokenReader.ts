import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';
import { CharLookupTable } from '../utils/charLookupTable';
import { KeywordParser } from '../parsers/KeywordParser';
import { KeywordTrie } from '../models/KeywordTrie';

const trie = new KeywordTrie([
    // binary
    ["and"],
    ["or"],
    ["is"],
    ["is", "not"],
    ["is", "distinct", "from"],
    ["is", "not", "distinct", "from"],
    ["like"],
    ["in"],
    ["exists"],
    ["between"],
    ["not", "like"],
    ["not", "in"],
    ["not", "exists"],
    ["not", "between"],
    ["escape"], // e.g. '10% OFF on all items' like '10\%%' escape '\'
    ["uescape"], // e.g. U&'d!0061t!+000061' uescape '!'
    ["similar"], // e.g. substring('abcdef' similar '%#"cd#"%' escape '#')
    ["placing"], // e.g. overlay('abcdef' placing 'cd' from 3 for 2)
    // unary
    ["not"],
    // unary - trim
    ["both"],
    ["leading"],
    ["trailing"],
    ["both", "from"], // Postgres
    ["leading", "from"], // Postgres
    ["trailing", "from"], // Postgres
    // unary - extract
    ["year", "from"],
    ["month", "from"],
    ["day", "from"],
    ["hour", "from"],
    ["minute", "from"],
    ["second", "from"],
    ["dow", "from"],
    ["doy", "from"],
    ["isodow", "from"],
    ["quarter", "from"],
    ["week", "from"],
    ["epoch", "from"],
    ["at", "time", "zone"],
    ["interval"],
    // The following are not considered operators.
    // ["from"], can be used as an operator only within the substring function, but it cannot be distinguished from the Form Clause. This will be resolved with a dedicated substring parser.
    // ["for"], can be used as an operator only within the substring function, but it cannot be distinguished from the For Clause. This will be resolved with a dedicated substring parser.
]);

const keywordParser = new KeywordParser(trie);

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
            const resut = this.input.slice(start, this.position);
            return this.createLexeme(TokenType.Operator, resut);
        }

        // Logical operators
        const result = keywordParser.parse(this.input, this.position);
        if (result !== null) {
            this.position = result.newPosition;
            return this.createLexeme(TokenType.Operator, result.keyword);
        }

        return null;
    }
}