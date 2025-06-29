import { BaseTokenReader } from "./BaseTokenReader";
import { Lexeme, TokenType } from '../models/Lexeme';
import { KeywordTrie } from "../models/KeywordTrie";
import { KeywordParser } from "../parsers/KeywordParser";

// Commands are those that require a dedicated parser.
// Keywords composed of multiple words are also considered commands.
// The exception is "type". Since types can be user-defined and cannot be accurately identified, they are treated as Identifiers.

const joinTrie = new KeywordTrie([
    ["join"],
    ["inner", "join"],
    ["cross", "join"],
    ["left", "join"],
    ["left", "outer", "join"],
    ["right", "join"],
    ["right", "outer", "join"],
    ["full", "join"],
    ["full", "outer", "join"],

    ["natural", "join"],
    ["natural", "inner", "join"],
    ["natural", "left", "join"],
    ["natural", "left", "outer", "join"],
    ["natural", "right", "join"],
    ["natural", "right", "outer", "join"],
    ["natural", "full", "join"],
    ["natural", "full", "outer", "join"],
]);
const keywordTrie = new KeywordTrie([
    ["with"],
    ["recursive"],
    ["materialized"],
    ["not", "materialized"],
    ["select"],
    ["from"],
    ["distinct"],
    ["distinct", "on"],
    ["where"],
    ["group", "by"],
    ["having"],
    ["order", "by"],
    ["limit"],
    ["offset"],
    ["fetch"],
    ["first"],
    ["next"],
    ["row"],
    ["row", "only"],
    ["rows", "only"],
    ["percent"],
    ["percent", "with", "ties"],
    // for
    ["for"],
    ["update"],
    ["share"],
    ["key", "share"],
    ["no", "key", "update"],
    // set operations
    ["union"],
    ["union", "all"],
    ["intersect"],
    ["intersect", "all"],
    ["except"],
    ["except", "all"],
    // between and
    ["beteen"],
    // window functions
    ["window"],
    ["over"],
    ["partition", "by"],
    ["range"],
    ["rows"],
    ["groups"],
    // aggregate functions with WITHIN GROUP
    ["within", "group"],
    // window frame
    ["current", "row"],
    ["unbounded", "preceding"],
    ["unbounded", "following"],
    ["preceding"],
    ["following"],
    // table join commands
    ["on"],
    ["using"],
    ["lateral"],
    // case 
    ["case"],
    ["case", "when"],
    ["when"],
    ["then"],
    ["else"],
    ["end"],
    // others
    ["insert", "into"],
    ["update"],
    ["delete", "from"],
    ["merge", "into"],
    ["matched"],
    ["not", "matched"],
    ["update", "set"],
    ["do", "nothing"],
    ["values"],
    ["set"],
    ["returning"],
    ["create", "table"],
    ["create", "temporary", "table"],
    ["tablesample"],
    // cast
    ["as"],
    // odrder
    ["asc"],
    ["desc"],
    ["nulls", "first"],
    ["nulls", "last"],
]);
const keywordParser = new KeywordParser(keywordTrie);
export const joinkeywordParser = new KeywordParser(joinTrie);

export class CommandTokenReader extends BaseTokenReader {
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        const keywordJoin = joinkeywordParser.parse(this.input, this.position);
        if (keywordJoin !== null) {
            this.position = keywordJoin.newPosition;
            return this.createLexeme(TokenType.Command, keywordJoin.keyword);
        }

        // Check for keyword identifiers
        const keyword = keywordParser.parse(this.input, this.position);
        if (keyword !== null) {
            this.position = keyword.newPosition;
            return this.createLexeme(TokenType.Command, keyword.keyword);
        }

        // check hint clause
        if (this.canRead(2) && this.input[this.position] === '/' && this.input[this.position + 1] === '*' && this.input[this.position + 2] === '+') {
            this.position += 3;
            const start = this.position;
            while (this.position + 1 < this.input.length) {
                if (this.input[this.position] === '*' && this.input[this.position + 1] === '/') {
                    this.position += 2;
                    return this.createLexeme(TokenType.Command, '/*+ ' + this.input.slice(start, this.position - 2).trim() + ' */');
                }
                this.position++;
            }
            throw new Error(`Block comment is not closed. position: ${this.position}`);
        }

        return null;
    }
}
