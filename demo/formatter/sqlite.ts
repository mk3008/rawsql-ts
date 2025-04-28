import { SelectQueryParser, Formatter } from 'rawsql-ts';

const sql = `SELECT user_id, name FROM users WHERE active = :active`;
const query = SelectQueryParser.parse(sql);

// SQLite formatting
const sqliteFormatter = new Formatter();
const sqliteFormattedSql = sqliteFormatter.format(query, Formatter.PRESETS.sqlite);
console.log('SQLite:', sqliteFormattedSql);
// => select "user_id", "name" from "users" where "active" = :active
