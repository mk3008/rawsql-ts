// This demo shows how to add a WHERE condition to a query using rawsql-ts!
// Written by a super energetic JK engineer!
import { SelectQueryParser, Formatter, SimpleSelectQuery } from 'rawsql-ts';

// Original SQL
const sql = `SELECT id, name, age FROM users`;
const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

// Add a WHERE condition (age >= 18)
query.appendWhereRaw('age >= 18');

// Format the result
const formatter = new Formatter();
const formattedSql = formatter.format(query);

console.log('Before:', sql);
console.log('After:', formattedSql);
// Output example:
// Before: SELECT id, name, age FROM users
// After: select "id", "name", "age" from "users" where "age" >= 18
