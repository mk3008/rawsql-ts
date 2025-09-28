<div v-pre>
# Type Alias: TableColumnResolver()

> **TableColumnResolver** = (`tableName`) => `string`[]

Defined in: [packages/core/src/transformers/TableColumnResolver.ts:18](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/TableColumnResolver.ts#L18)

Type definition for a function that resolves column names from a table name.

This is used to provide table structure information (column names) for physical tables
when expanding wildcard selectors (e.g., table.*) in SQL query analysis.

## Parameters

### tableName

`string`

The name of the table to resolve columns for.

## Returns

`string`[]

An array of column names (strings) for the specified table.

## Example

```typescript
const resolver: TableColumnResolver = (table) => table === 'users' ? ['id', 'email'] : [];
const collector = new SchemaCollector(resolver);
const schemas = collector.collect(SelectQueryParser.parse('SELECT * FROM users'));
```
Related tests: packages/core/tests/transformers/SchemaCollector.test.ts
</div>
