import { DefaultFormatter } from './models/DefaultFormatter';
import { GroupByClauseParser } from './parsers/GroupByParser';
import { HavingClauseParser } from './parsers/HavingParser';
import { SqlTokenizer } from './parsers/SqlTokenizer';
import { ValueParser } from './parsers/ValueParser';

const formatter = new DefaultFormatter();

const text = "'2025-03-28 15:30:00'::timestamp AT TIME ZONE 'America/New_York'";

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