// This demo demonstrates how to use a left join and append a WHERE clause using rawsql-ts.
//
// Note:
// - When adding a condition (such as with appendWhereRaw), it is only necessary to ensure that the target column (e.g., user_id) is selectable in the query.
// - There is no need to be concerned about whether the column originates from a joined table, a subquery, or any other source. The library automatically manages all join and subquery logic.
//
// Execution instructions for Windows:
// 1. Open a terminal in the project root directory.
// 2. Run the following command:
//    npx ts-node demo/appendJoin/index.ts
//
// This will execute the TypeScript file directly using ts-node.
import { SelectQueryParser, Formatter, SimpleSelectQuery } from 'rawsql-ts';

// Parse the base query
const query = SelectQueryParser.parse('SELECT u.user_id, u.name FROM users u') as SimpleSelectQuery;

// Add LEFT JOIN using the leftJoinRaw method (use user_id as join key)
query.leftJoinRaw('orders', 'o', ['user_id']);

// Add WHERE clause using appendWhereRaw (no need to check existence)
query.appendWhereRaw('o.order_id IS NULL');

const formatter = new Formatter();
const formattedSql = formatter.format(query);

console.log(formattedSql);

// => select "u"."user_id", "u"."name" from "users" as "u" left join "orders" as "o" on "u"."user_id" = "o"."user_id" where "o"."order_id" is null
