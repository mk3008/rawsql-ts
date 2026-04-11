<div v-pre>
# Class: UpstreamSelectQueryFinder

Defined in: [packages/core/src/transformers/UpstreamSelectQueryFinder.ts:21](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/UpstreamSelectQueryFinder.ts#L21)

UpstreamSelectQueryFinder searches upstream queries for the specified columns.
If a query (including its upstream CTEs or subqueries) contains all columns,
it returns the highest such SelectQuery. Otherwise, it searches downstream.

For BinarySelectQuery (UNION/INTERSECT/EXCEPT), this finder processes each branch
independently, as SelectableColumnCollector is designed for SimpleSelectQuery only.
This approach ensures accurate column detection within individual SELECT branches
while maintaining compatibility with compound query structures.

## Constructors

### Constructor

> **new UpstreamSelectQueryFinder**(`tableColumnResolver?`, `options?`): `UpstreamSelectQueryFinder`

Defined in: [packages/core/src/transformers/UpstreamSelectQueryFinder.ts:26](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/UpstreamSelectQueryFinder.ts#L26)

#### Parameters

##### tableColumnResolver?

(`tableName`) => `string`[]

##### options?

###### ignoreCaseAndUnderscore?

`boolean`

#### Returns

`UpstreamSelectQueryFinder`

## Methods

### find()

> **find**(`query`, `columnNames`): [`SimpleSelectQuery`](SimpleSelectQuery.md)[]

Defined in: [packages/core/src/transformers/UpstreamSelectQueryFinder.ts:44](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/UpstreamSelectQueryFinder.ts#L44)

Finds the highest SelectQuery containing all specified columns.

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The root SelectQuery to search.

##### columnNames

A column name or array of column names to check for.

`string` | `string`[]

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)[]

An array of SelectQuery objects, or an empty array if not found.
</div>
