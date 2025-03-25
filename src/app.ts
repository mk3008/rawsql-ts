import { DefaultFormatter } from './models/DefaultFormatter';
import { SelectClauseParser } from './parsers/SelectParser';
import { SqlTokenizer } from './parsers/sqlTokenizer';

const formatter = new DefaultFormatter();

const text = `select case when a.status = 'active' then 1 else 0 end as is_active`;

const lexemes = new SqlTokenizer(text).readLexmes();
console.log(JSON.stringify(lexemes, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const clause = SelectClauseParser.ParseFromText(text);
console.log(JSON.stringify(clause, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const sql = formatter.visit(clause);
console.log(sql);