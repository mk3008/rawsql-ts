import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

// 可変検索条件がないクエリを用意する
const sql = `SELECT id, name FROM users WHERE active = true`;
const baseQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

// クエリに状態（検索条件）を適用する
const injectedQuery = new SqlParamInjector().inject(baseQuery, { id: 42, name: 'Alice' });

// クエリ文字列とパラメータを取得する
const { formattedSql, params } = new SqlFormatter().format(injectedQuery);

console.log(formattedSql);
// 検索条件が追加されたクエリ文字列を取得できる
// -> SELECT id, name FROM users WHERE active = true AND id = :id AND name = :name

console.log(params);
// 状態をパラメータとして取得できる
// -> { id: 42, name: 'Alice' }
