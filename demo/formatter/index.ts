// This demo demonstrates how to format a parsed SQL query using rawsql-ts.
//
// Note:
// - The Formatter class can be used to convert a parsed query object back into a formatted SQL string.
// - The formatting will automatically handle proper quoting and SQL syntax for PostgreSQL.
// - Reserved keywords are converted to lowercase.
// - The output SQL will be formatted as a single line.
// - Any SQL comments in the original query will be removed in the formatted output.
//
// Execution instructions for Windows:
// 1. Open a terminal in the project root directory.
// 2. Run the following command:
//    npx ts-node demo/formatter/index.ts
//
// This will execute the TypeScript file directly using ts-node.

import { SelectQueryParser, Formatter } from 'rawsql-ts';

const sql = `SELECT user_id, name FROM users WHERE active = TRUE`;
const query = SelectQueryParser.parse(sql);
const formatter = new Formatter();
const formattedSql = formatter.format(query);

console.log(formattedSql);

// => select "user_id", "name" from "users" where "active" = true
