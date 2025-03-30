import { DefaultFormatter } from './models/DefaultFormatter';
import { FromClauseParser } from './parsers/FromClauseParser';
import { GroupByClauseParser } from './parsers/GroupByParser';
import { HavingClauseParser } from './parsers/HavingParser';
import { SqlTokenizer } from './parsers/SqlTokenizer';
import { ValueParser } from './parsers/ValueParser';

const formatter = new DefaultFormatter();

const text = "from employees natural join departments";

const lexemes = new SqlTokenizer(text).readLexmes();
console.log(JSON.stringify(lexemes, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const clause = FromClauseParser.parseFromText(text);
console.log(JSON.stringify(clause, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const sql = formatter.visit(clause);
console.log(sql);