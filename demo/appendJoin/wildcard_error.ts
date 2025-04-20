// This demo demonstrates how to use a left join and append a WHERE clause with wildcard column selection using rawsql-ts.
//
// Note:
// - When adding a condition (such as with appendWhereRaw), it is only necessary to ensure that the target column (e.g., user_id) is selectable in the query.
// - There is no need to be concerned about whether the column originates from a joined table, a subquery, or any other source. The library automatically manages all join and subquery logic.
//
// Important:
// - If you use a wildcard column selection (e.g., SELECT u.*), column name resolution for JOIN conditions may fail if the column list cannot be determined from the schema or context.
// - In this case, an error such as "Invalid JOIN condition. The specified columns were not found: user_id" is expected and indicates correct behavior for ambiguous column resolution.
//
// Execution instructions for Windows:
// 1. Open a terminal in the project root directory.
// 2. Run the following command:
//    npx ts-node demo/appendJoin/wildcard.ts
//
// This will execute the TypeScript file directly using ts-node.
import { SelectQueryParser, Formatter, SimpleSelectQuery } from 'rawsql-ts';

// Parse the base query with wildcard column selection
const query = SelectQueryParser.parse('SELECT u.* FROM users u') as SimpleSelectQuery;

try {
    // Add LEFT JOIN using the leftJoinRaw method (use user_id as join key)
    query.leftJoinRaw('orders', 'o', ['user_id']);

    // Add WHERE clause using appendWhereRaw (no need to check existence)
    query.appendWhereRaw('o.order_id IS NULL');

    const formatter = new Formatter();
    const formattedSql = formatter.format(query);

    console.log(formattedSql);
} catch (err) {
    // If an error occurs, output the error message for debugging purposes.
    // This is expected when column name resolution fails with wildcard selection.
    console.error('JOIN error:', err instanceof Error ? err.message : err);

    // => JOIN error: Invalid JOIN condition. The specified columns were not found: user_id
}
