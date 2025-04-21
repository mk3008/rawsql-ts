// Usage Example Demo for rawsql-ts
// This script demonstrates the code from the README.md Usage Example section.
// Run with: ts-node demo/collector/index.ts

import { TableColumnResolver, SelectQueryParser, SelectableColumnCollector, SelectValueCollector, TableSourceCollector, Formatter } from 'rawsql-ts';

// TableColumnResolver example
const resolver: TableColumnResolver = (tableName) => {
    if (tableName === 'users') return ['user_id', 'user_name', 'email'];
    if (tableName === 'posts') return ['post_id', 'user_id', 'title', 'content'];
    return [];
};

const sql = `SELECT u.*, p.title as post_title FROM users u INNER JOIN posts p ON u.user_id = p.user_id`;
const query = SelectQueryParser.parse(sql);
const formatter = new Formatter();

// Collects information from the SELECT clause.
// To expand wildcards, you must specify a TableColumnResolver.
const selectValueCollector = new SelectValueCollector(resolver);
const selectValues = selectValueCollector.collect(query);
// Log the name and formatted value of each select value
console.log('Select values:');
selectValues.forEach(val => {
    console.log(`  name: ${val.name}, value: ${formatter.format(val.value)}`);
});
/*
Select values:
  name: post_title, value: "p"."title"
  name: user_id, value: "u"."user_id"
  name: user_name, value: "u"."user_name"
  name: email, value: "u"."email"
*/

// Collects selectable columns from the FROM/JOIN clauses.
// You can get accurate information by specifying a TableColumnResolver.
// If omitted, the information will be inferred from the query content.
const selectableColumnCollector = new SelectableColumnCollector(resolver);
const selectableColumns = selectableColumnCollector.collect(query);
// Log detailed info for each selectable column
console.log('Selectable columns:');
selectableColumns.forEach(val => {
    console.log(`  name: ${val.name}, value: ${formatter.format(val.value)}`);
});
/*
Selectable columns:
  name: post_title, value: "p"."title"
  name: user_id, value: "u"."user_id"
  name: user_name, value: "u"."user_name"
  name: email, value: "u"."email"
  name: post_id, value: "p"."post_id"
  name: title, value: "p"."title"
  name: content, value: "p"."content"
*/

// Retrieves physical table sources.
const tableSourceCollector = new TableSourceCollector();
const sources = tableSourceCollector.collect(query);
// Log detailed info for each source
console.log('Sources:');
sources.forEach(src => {
    console.log(`  name: ${src.getSourceName()}`);
});
/*
TableSources:
  name: users
  name: posts
*/
