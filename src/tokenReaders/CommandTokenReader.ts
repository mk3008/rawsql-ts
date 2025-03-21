import { BaseTokenReader } from "./BaseTokenReader";
import { Lexeme, TokenType } from '../models/Lexeme';
import { KeywordTrie } from "../models/KeywordTrie";
import { KeywordParser } from "../KeywordParser";

// Commands are those that require a dedicated parser.
// Keywords composed of multiple words are also considered commands.
// The exception is "type". Since types can be user-defined and cannot be accurately identified, they are treated as Identifiers.
const trie = new KeywordTrie([
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
    ["for"],
    ["offset"],
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
    ["range", "between"],
    ["rows"],
    ["rows", "between"],
    ["groups"],
    ["groups", "between"],
    // table join commands
    ["on"],
    ["using"],
    ["natural"],
    ["join"],
    ["inner", "join"],
    ["cross", "join"],
    ["left", "join"],
    ["left", "outer", "join"],
    ["right", "join"],
    ["right", "outer", "join"],
    ["full", "join"],
    ["lateral"],
    // trim
    ["leading"],
    ["trailing"],
    ["both"],
    ["both", "from"],
    ["leading", "from"],
    ["trailing", "from"],
    ["both", "leading"],
    ["both", "trailing"],
    // date, time, extract
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
    ["array"]
]);
const parser = new KeywordParser(trie);

export class CommandTokenReader extends BaseTokenReader {

    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        // Check for keyword identifiers
        const keyword = parser.parse(this.input, this.position);
        if (keyword !== null) {
            this.position = keyword.newPosition;
            return this.createLexeme(TokenType.Command, keyword.keyword, keyword.keyword.toLowerCase());
        }

        return null;
    }
}