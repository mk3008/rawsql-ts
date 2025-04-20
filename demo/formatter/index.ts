// This demo shows how to format a parsed SQL query using rawsql-ts!
// Written by a super energetic JK engineer!
import { SelectQueryParser, Formatter } from 'rawsql-ts';

const sql = `SELECT id, name FROM users WHERE active = TRUE`;
const query = SelectQueryParser.parse(sql);
const formatter = new Formatter();
const formattedSql = formatter.format(query);

console.log(formattedSql);

// => select "id", "name" from "users" where "active" = true
