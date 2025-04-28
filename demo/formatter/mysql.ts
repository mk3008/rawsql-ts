import { SelectQueryParser, Formatter } from 'rawsql-ts';

const sql = `SELECT user_id, name FROM users WHERE active = :active`;
const query = SelectQueryParser.parse(sql);

// MySQL formatting
const mysqlFormatter = new Formatter();
const mysqlFormattedSql = mysqlFormatter.format(query, Formatter.PRESETS.mysql);
console.log('MySQL:', mysqlFormattedSql);
// => select `user_id`, `name` from `users` where `active` = :active
