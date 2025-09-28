<div v-pre>
# Class: QueryBuilder

Defined in: [packages/core/src/transformers/QueryBuilder.ts:16](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/QueryBuilder.ts#L16)

QueryBuilder provides static methods to build or convert various SQL query objects.

## Methods

### buildBinaryQuery()

> `static` **buildBinaryQuery**(`queries`, `operator`): [`BinarySelectQuery`](BinarySelectQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:24](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/QueryBuilder.ts#L24)

Builds a BinarySelectQuery by combining an array of SelectQuery using the specified operator.
Throws if less than two queries are provided.

#### Parameters

##### queries

[`SelectQuery`](../interfaces/SelectQuery.md)[]

Array of SelectQuery to combine

##### operator

`string`

SQL operator to use (e.g. 'union', 'union all', 'intersect', 'except')

#### Returns

[`BinarySelectQuery`](BinarySelectQuery.md)

BinarySelectQuery

***

### buildSimpleQuery()

> `static` **buildSimpleQuery**(`query`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:55](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/QueryBuilder.ts#L55)

Converts a SELECT query to a standard SimpleSelectQuery form.

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The query to convert

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

A SimpleSelectQuery

***

### buildCreateTableQuery()

> `static` **buildCreateTableQuery**(`query`, `tableName`, `isTemporary`): `CreateTableQuery`

Defined in: [packages/core/src/transformers/QueryBuilder.ts:212](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/QueryBuilder.ts#L212)

Converts a SELECT query to a CREATE TABLE query (CREATE [TEMPORARY] TABLE ... AS SELECT ...)

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The SELECT query to use as the source

##### tableName

`string`

The name of the table to create

##### isTemporary

`boolean` = `false`

If true, creates a temporary table

#### Returns

`CreateTableQuery`

A CreateTableQuery instance

***

### buildInsertQuery()

> `static` **buildInsertQuery**(`selectQuery`, `tableName`): [`InsertQuery`](InsertQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:227](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/QueryBuilder.ts#L227)

Converts a SELECT query to an INSERT query (INSERT INTO ... SELECT ...)

#### Parameters

##### selectQuery

[`SimpleSelectQuery`](SimpleSelectQuery.md)

The SELECT query to use as the source

##### tableName

`string`

The name of the table to insert into

#### Returns

[`InsertQuery`](InsertQuery.md)

An InsertQuery instance

***

### buildUpdateQuery()

> `static` **buildUpdateQuery**(`selectQuery`, `selectSourceName`, `updateTableExprRaw`, `primaryKeys`): `UpdateQuery`

Defined in: [packages/core/src/transformers/QueryBuilder.ts:261](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/QueryBuilder.ts#L261)

Builds an UPDATE query from a SELECT query, table name, and primary key(s).

#### Parameters

##### selectQuery

[`SimpleSelectQuery`](SimpleSelectQuery.md)

The SELECT query providing new values (must select all columns to update and PKs)

##### selectSourceName

`string`

##### updateTableExprRaw

`string`

The table name to update

##### primaryKeys

The primary key column name(s)

`string` | `string`[]

#### Returns

`UpdateQuery`

UpdateQuery instance
</div>
