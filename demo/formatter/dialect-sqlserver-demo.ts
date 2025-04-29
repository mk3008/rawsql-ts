// Execution instructions for Windows:
// 1. Open a terminal in the project root directory.
// 2. Run the following command:
//    npx ts-node demo/formatter/dialect-sqlserver-demo.ts

import { SelectQueryParser, Formatter } from 'rawsql-ts';

const sql = 'select [user_id], [name] from [users] where [active] = @active';
const query = SelectQueryParser.parse(sql);

// Default formatting
const defaultFormatter = new Formatter();
const defaultFormattedSql = defaultFormatter.format(query);
console.log('Default   :', defaultFormattedSql);
// => select "user_id", "name" from "users" where "active" = :active

// MySQL formatting
const mysqlFormatter = new Formatter();
const mysqlFormattedSql = mysqlFormatter.format(query, Formatter.PRESETS.mysql);
console.log('MySQL     :', mysqlFormattedSql);
// => select `user_id`, `name` from `users` where `active` = ?

// PostgreSQL formatting
const postgresFormatter = new Formatter();
const postgresFormattedSql = postgresFormatter.format(query, Formatter.PRESETS.postgres);
console.log('PostgreSQL:', postgresFormattedSql);
// => select "user_id", "name" from "users" where "active" = :active

// SQL Server formatting
const sqlServerFormatter = new Formatter();
const sqlServerFormattedSql = sqlServerFormatter.format(query, Formatter.PRESETS.sqlserver);
console.log('SQL Server:', sqlServerFormattedSql);
// => select [user_id], [name] from [users] where [active] = @active

// SQLite formatting
const sqliteFormatter = new Formatter();
const sqliteFormattedSql = sqliteFormatter.format(query, Formatter.PRESETS.sqlite);
console.log('SQLite    :', sqliteFormattedSql);
// => select "user_id", "name" from "users" where "active" = :active
