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
    ["ilike"],
    ["in"],
    ["exists"],
    ["between"],
    ["not", "like"],
    ["not", "ilike"],
    ["not", "in"],
    ["not", "exists"],
    ["not", "between"],
    ["escape"], // e.g. '10% OFF on all items' like '10\%%' escape '\'
    ["uescape"], // e.g. U&'d!0061t!+000061' uescape '!'
    ["similar", "to"], // e.g. name similar to 'J(ohn|ane)%'
    ["not", "similar", "to"], // e.g. name not similar to 'J(ohn|ane)%'
    ["similar"], // e.g. substring('abcdef' similar '%#"cd#"%' escape '#')
    ["placing"], // e.g. overlay('abcdef' placing 'cd' from 3 for 2)
    ["rlike"], // MySQL regular expression operator
    ["regexp"], // MySQL regular expression operator
    ["mod"], // MySQL modulo operator
    ["xor"], // MySQL exclusive or operator
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
    // The following are not considered operators.
    // ["from"], can be used as an operator only within the substring function, but it cannot be distinguished from the Form Clause. This will be resolved with a dedicated substring parser.
    // ["for"], can be used as an operator only within the substring function, but it cannot be distinguished from the For Clause. This will be resolved with a dedicated substring parser.
]);

// Typed literal format
const operatorOrTypeTrie = new KeywordTrie([
    ["date"],
    ["time"],
    ["timestamp"],
    ["timestamptz"],// timestamp with time zone
    ["timetz"],     // time with time zone
    ["interval"],
    ["boolean"],
    ["integer"],
    ["bigint"],
    ["smallint"],
    ["numeric"],
    ["decimal"],
    ["real"],
    ["double", "precision"],
    ["double", "precision"],
    ["character", "varying"],
    ["time", "without", "time", "zone"],
    ["time", "with", "time", "zone"],
    ["timestamp", "without", "time", "zone"],
    ["timestamp", "with", "time", "zone"],
]);

const keywordParser = new KeywordParser(trie);
const operatorOrTypeParser = new KeywordParser(operatorOrTypeTrie);

// Indicates the token may also represent a type (e.g., 'interval')
const MAYBE_TYPE = true;

export class OperatorTokenReader extends BaseTokenReader {
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        /*
            NOTE:
            Asterisks could potentially be wildcard identifiers,
            but since they're indistinguishable at this stage, they're treated as Operators at the token level.
            The Parser needs to determine whether they are appropriate Operators or Identifiers.
        */

        const char = this.input[this.position];

        if (CharLookupTable.isOperatorSymbol(char)) {
            const start = this.position;

            while (this.canRead() && CharLookupTable.isOperatorSymbol(this.input[this.position])) {
                this.position++;

                if (!this.canRead()) {
                    break;
                }

                const previous = this.input[this.position - 1];
                const next = this.input[this.position];

                // Stop before consuming the second character of comment prefixes to avoid zero-length slices.
                if ((previous === '-' && next === '-') || (previous === '/' && next === '*')) {
                    break;
                }
            }

            // Ensure progress even when a comment prefix appears immediately.
            if (this.position === start) {
                this.position++;
            }

            const resut = this.input.slice(start, this.position);
            return this.createLexeme(TokenType.Operator, resut);
        }

        // Logical operators
        let result = operatorOrTypeParser.parse(this.input, this.position);
        if (result !== null) {
            // Special handling for typed literal format.
            // Treated as an operator in cases like `interval '2 days'`,
            // but can also be used as a type in expressions like `'1 month'::interval`,
            // so we return it as both Operator and Type.
            this.position = result.newPosition;
            return this.createLexeme(TokenType.Operator | TokenType.Type | TokenType.Identifier, result.keyword);
        }

        result = keywordParser.parse(this.input, this.position);
        if (result !== null) {
            this.position = result.newPosition;
            return this.createLexeme(TokenType.Operator, result.keyword);
        }

        return null;
    }
}
