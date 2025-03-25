import { DefaultFormatter } from './models/DefaultFormatter';
import { SqlTokenizer } from './parsers/sqlTokenizer';
import { WhereClauseParser } from './parsers/WhereClauseParser';

const formatter = new DefaultFormatter();

const text = `where 1=1 and a.id = 1`;

const lexemes = new SqlTokenizer(text).readLexmes();
console.log(JSON.stringify(lexemes, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const clause = WhereClauseParser.ParseFromText(text);
console.log(JSON.stringify(clause, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const sql = formatter.visit(clause);
console.log(sql);