<div v-pre>
# Class: SqlPaginationInjector

Defined in: [packages/core/src/transformers/SqlPaginationInjector.ts:20](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlPaginationInjector.ts#L20)

SqlPaginationInjector injects pagination (LIMIT/OFFSET) into a SelectQuery model,
creating LIMIT and OFFSET clauses based on provided pagination options.

## Constructors

### Constructor

> **new SqlPaginationInjector**(): `SqlPaginationInjector`

#### Returns

`SqlPaginationInjector`

## Methods

### removePagination()

> `static` **removePagination**(`query`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/SqlPaginationInjector.ts:85](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlPaginationInjector.ts#L85)

Removes LIMIT and OFFSET clauses from the given query.

#### Parameters

##### query

The SelectQuery to modify

`string` | [`SimpleSelectQuery`](SimpleSelectQuery.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

The modified SimpleSelectQuery with pagination removed

***

### inject()

> **inject**(`query`, `pagination`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/SqlPaginationInjector.ts:28](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlPaginationInjector.ts#L28)

Injects pagination as LIMIT/OFFSET clauses into the given query model.

#### Parameters

##### query

The SelectQuery to modify

`string` | [`SimpleSelectQuery`](SimpleSelectQuery.md)

##### pagination

[`PaginationOptions`](../interfaces/PaginationOptions.md)

Pagination options containing page number and page size

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

The modified SimpleSelectQuery with pagination applied
</div>
