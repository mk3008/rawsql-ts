// This demo demonstrates how to add a WHERE condition to a query using rawsql-ts.
//
// Note:
// - When adding a condition (such as with appendWhereRaw), it is only necessary to ensure that the target column (e.g., age) is selectable in the query.
// - There is no need to be concerned about whether the column originates from a joined table, a subquery, or any other source. The library automatically manages all join and subquery logic.
//
// Execution instructions for Windows:
// 1. Open a terminal in the project root directory.
// 2. Run the following command:
//    npx ts-node demo/appendWhere/index.ts
//
// This will execute the TypeScript file directly using ts-node.

import { SelectQueryParser, Formatter, SimpleSelectQuery } from 'rawsql-ts';

// Parse the base query
const sql = `SELECT user_id, name, age FROM users`;
const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

// Add multiple WHERE conditions using appendWhereRaw
// Note: When appendWhereRaw is called multiple times, each condition is combined using the AND operator in the final SQL statement.
query.appendWhereRaw('age >= 18');
query.appendWhereRaw('user_id > 100');

// Format the result
const formatter = new Formatter();
const formattedSql = formatter.format(query);

console.log('Before:', sql);
console.log('After:', formattedSql);
// Output example:
// Before: SELECT user_id, name, age FROM users
// After: select "user_id", "name", "age" from "users" where "age" >= 18 and "user_id" > 100
