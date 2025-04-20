import { SelectQueryParser, Formatter } from 'rawsql-ts';

const sql = `SELECT id, name FROM users WHERE active = TRUE`;
const query = SelectQueryParser.parse(sql);
const formatter = new Formatter();
const formattedSql = formatter.format(query);
console.log(formattedSql);
