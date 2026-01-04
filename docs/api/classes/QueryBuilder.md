<div v-pre>
# Class: QueryBuilder

Defined in: [packages/core/src/transformers/QueryBuilder.ts:24](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L24)

QueryBuilder provides static methods to build or convert various SQL query objects.

## Methods

### buildBinaryQuery()

> `static` **buildBinaryQuery**(`queries`, `operator`): [`BinarySelectQuery`](BinarySelectQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:32](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L32)

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

Defined in: [packages/core/src/transformers/QueryBuilder.ts:63](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L63)

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

> `static` **buildCreateTableQuery**(`query`, `tableName`, `isTemporary`, `ifNotExists`): [`CreateTableQuery`](CreateTableQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:220](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L220)

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

##### ifNotExists

`boolean` = `false`

#### Returns

[`CreateTableQuery`](CreateTableQuery.md)

A CreateTableQuery instance

***

### buildInsertQuery()

> `static` **buildInsertQuery**(`selectQuery`, `targetOrOptions`, `explicitColumns?`): [`InsertQuery`](InsertQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:232](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L232)

Converts a SELECT query to an INSERT query (INSERT INTO ... SELECT ...).

#### Parameters

##### selectQuery

[`SimpleSelectQuery`](SimpleSelectQuery.md)

##### targetOrOptions

`string` | [`InsertQueryConversionOptions`](../interfaces/InsertQueryConversionOptions.md)

##### explicitColumns?

`string`[]

#### Returns

[`InsertQuery`](InsertQuery.md)

***

### convertInsertValuesToSelect()

> `static` **convertInsertValuesToSelect**(`insertQuery`): [`InsertQuery`](InsertQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:250](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L250)

Converts an INSERT ... VALUES query into INSERT ... SELECT form using UNION ALL.

#### Parameters

##### insertQuery

[`InsertQuery`](InsertQuery.md)

The VALUES-based InsertQuery to convert.

#### Returns

[`InsertQuery`](InsertQuery.md)

A new InsertQuery that selects rows instead of using VALUES.

***

### convertInsertSelectToValues()

> `static` **convertInsertSelectToValues**(`insertQuery`): [`InsertQuery`](InsertQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:259](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L259)

Converts an INSERT ... SELECT (optionally with UNION ALL) into INSERT ... VALUES form.

#### Parameters

##### insertQuery

[`InsertQuery`](InsertQuery.md)

The SELECT-based InsertQuery to convert.

#### Returns

[`InsertQuery`](InsertQuery.md)

A new InsertQuery that uses VALUES tuples.

***

### convertInsertToReturningSelect()

> `static` **convertInsertToReturningSelect**(`insertQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:266](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L266)

Builds a SELECT query that reflects the INSERT's RETURNING output (or count when RETURNING is absent).

#### Parameters

##### insertQuery

[`InsertQuery`](InsertQuery.md)

##### options?

[`InsertResultSelectOptions`](../interfaces/InsertResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

***

### convertUpdateToReturningSelect()

> `static` **convertUpdateToReturningSelect**(`updateQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:273](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L273)

#### Parameters

##### updateQuery

[`UpdateQuery`](UpdateQuery.md)

##### options?

[`UpdateResultSelectOptions`](../interfaces/UpdateResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

***

### convertDeleteToReturningSelect()

> `static` **convertDeleteToReturningSelect**(`deleteQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:280](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L280)

#### Parameters

##### deleteQuery

[`DeleteQuery`](DeleteQuery.md)

##### options?

[`DeleteResultSelectOptions`](../interfaces/DeleteResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

***

### convertMergeToReturningSelect()

> `static` **convertMergeToReturningSelect**(`mergeQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:287](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L287)

#### Parameters

##### mergeQuery

[`MergeQuery`](MergeQuery.md)

##### options?

[`MergeResultSelectOptions`](../interfaces/MergeResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

***

### buildUpdateQuery()

> `static` **buildUpdateQuery**(`selectQuery`, `selectSourceOrOptions`, `updateTableExprRaw?`, `primaryKeys?`): [`UpdateQuery`](UpdateQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:297](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L297)

Builds an UPDATE query from a SELECT query and conversion options.

#### Parameters

##### selectQuery

[`SimpleSelectQuery`](SimpleSelectQuery.md)

##### selectSourceOrOptions

`string` | [`UpdateQueryConversionOptions`](../interfaces/UpdateQueryConversionOptions.md)

##### updateTableExprRaw?

`string`

##### primaryKeys?

`string` | `string`[]

#### Returns

[`UpdateQuery`](UpdateQuery.md)

***

### buildDeleteQuery()

> `static` **buildDeleteQuery**(`selectQuery`, `options`): [`DeleteQuery`](DeleteQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:332](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L332)

Builds a DELETE query that deletes the rows matched by the SELECT query output.

#### Parameters

##### selectQuery

[`SimpleSelectQuery`](SimpleSelectQuery.md)

##### options

[`DeleteQueryConversionOptions`](../interfaces/DeleteQueryConversionOptions.md)

#### Returns

[`DeleteQuery`](DeleteQuery.md)

***

### buildMergeQuery()

> `static` **buildMergeQuery**(`selectQuery`, `options`): [`MergeQuery`](MergeQuery.md)

Defined in: [packages/core/src/transformers/QueryBuilder.ts:365](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/QueryBuilder.ts#L365)

Builds a MERGE query (upsert) that coordinates actions based on row matches.

#### Parameters

##### selectQuery

[`SimpleSelectQuery`](SimpleSelectQuery.md)

##### options

[`MergeQueryConversionOptions`](../interfaces/MergeQueryConversionOptions.md)

#### Returns

[`MergeQuery`](MergeQuery.md)
</div>
