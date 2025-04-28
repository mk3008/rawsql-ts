import { SelectQueryParser, Formatter } from 'rawsql-ts';

const sql = `SELECT user_id, name FROM users WHERE active = :active`;
const query = SelectQueryParser.parse(sql);

// SQL Server formatting
const sqlServerFormatter = new Formatter();
const sqlServerFormattedSql = sqlServerFormatter.format(query, Formatter.PRESETS.sqlserver);
console.log('SQL Server:', sqlServerFormattedSql);
// => select [user_id], [name] from [users] where [active] = @active
