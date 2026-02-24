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

    // LATERAL JOIN patterns
    ["lateral", "join"],
    ["lateral", "inner", "join"],
    ["lateral", "left", "join"],
    ["lateral", "left", "outer", "join"],
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
    // window functions
    ["window"],
    ["over"],
    ["partition", "by"],
    ["range"],
    ["rows"],
    ["groups"],
    // aggregate functions with WITHIN GROUP
    ["within", "group"],
    // table functions with WITH ORDINALITY  
    ["with", "ordinality"],
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
    ["not", "matched", "by", "source"],
    ["not", "matched", "by", "target"],
    ["update", "set"],
    ["if", "not", "exists"],
    ["if", "exists"],
    ["do", "nothing"],
    ["insert", "default", "values"],
    ["values"],
    ["set"],
    ["returning"],
    ["analyze"],
    ["create", "table"],
    ["create", "temporary", "table"],
    ["create", "temp", "table"],
    ["create", "unlogged", "table"],
    ["create", "schema"],
    ["create", "sequence"],
    ["create", "temporary", "sequence"],
    ["create", "temp", "sequence"],
    ["alter", "table"],
    ["alter", "sequence"],
    ["drop", "table"],
    ["drop", "schema"],
    ["drop", "index"],
    ["drop", "sequence"],
    ["drop", "constraint"],
    ["comment", "on", "table"],
    ["comment", "on", "column"],
    ["create", "index"],
    ["create", "unique", "index"],
    ["add"],
    ["add", "constraint"],
    ["constraint"],
    ["primary", "key"],
    ["unique"],
    ["unique", "key"],
    ["foreign", "key"],
    ["references"],
    ["check"],
    ["default"],
    ["not", "null"],
    ["null"],
    ["generated", "always"],
    ["generated", "always", "as", "identity"],
    ["generated", "by", "default"],
    ["generated", "by", "default", "as", "identity"],
    ["identity"],
    ["collate"],
    ["deferrable"],
    ["not", "deferrable"],
    ["initially", "immediate"],
    ["initially", "deferred"],
    ["match"],
    ["match", "full"],
    ["match", "partial"],
    ["match", "simple"],
    ["not", "valid"],
    ["on", "delete"],
    ["on", "update"],
    ["cascade"],
    ["restrict"],
    ["no", "action"],
    ["set", "null"],
    ["set", "default"],
    ["include"],
    ["only"],
    ["concurrently"],
    ["tablespace"],
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
export { keywordTrie as commandKeywordTrie };

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
            const lexeme = this.createLexeme(TokenType.Command, keyword.keyword, keyword.comments);
            
            // Add positioned comments if comments exist (convert from keyword parser comments)
            if (keyword.comments && keyword.comments.length > 0) {
                lexeme.positionedComments = [{
                    position: 'after' as const,
                    comments: keyword.comments
                }];
            }
            
            return lexeme;
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


