import { Formatter } from './visitors/Formatter';
import { FromClauseParser } from './parsers/FromClauseParser';
import { GroupByClauseParser } from './parsers/GroupByParser';
import { HavingClauseParser } from './parsers/HavingParser';
import { OrderByClauseParser } from './parsers/OrderByClauseParser';
import { SelectQueryParser } from './parsers/SelectQueryParser';
import { SqlTokenizer } from './parsers/SqlTokenizer';
import { ValueParser } from './parsers/ValueParser';
import { WhereClauseParser } from './parsers/WhereClauseParser';

const formatter = new Formatter();

const text = "c.*";

const lexemes = new SqlTokenizer(text).readLexmes();
console.log(JSON.stringify(lexemes, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const clause = ValueParser.parseFromText(text);
console.log(JSON.stringify(clause, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const sql = formatter.visit(clause);
console.log(sql);