import { DefaultFormatter } from './models/DefaultFormatter';
import { OrderByClauseParser } from './parsers/OrderByClauseParser';
import { SqlTokenizer } from './parsers/SqlTokenizer';

const formatter = new DefaultFormatter();

const text = `order by 1=1, a.id, a.name nulls first, a.created_at desc`;

const lexemes = new SqlTokenizer(text).readLexmes();
console.log(JSON.stringify(lexemes, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const clause = OrderByClauseParser.ParseFromText(text);
console.log(JSON.stringify(clause, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const sql = formatter.visit(clause);
console.log(sql);