import { DefaultFormatter } from './models/DefaultFormatter';
import { GroupByClauseParser } from './parsers/GroupByParser';
import { HavingClauseParser } from './parsers/HavingParser';
import { SqlTokenizer } from './parsers/SqlTokenizer';

const formatter = new DefaultFormatter();

const text = `group by grouping sets ((department_id), (job_id), (department_id, job_id))`;

const lexemes = new SqlTokenizer(text).readLexmes();
console.log(JSON.stringify(lexemes, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const clause = GroupByClauseParser.ParseFromText(text);
console.log(JSON.stringify(clause, (_, value) => {
    return value === null ? undefined : value;
}, 2));

const sql = formatter.visit(clause);
console.log(sql);