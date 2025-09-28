<div v-pre>
# Class: PostgresJsonQueryBuilder

Defined in: [packages/core/src/transformers/PostgresJsonQueryBuilder.ts:38](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/PostgresJsonQueryBuilder.ts#L38)

PostgreSQL JSON query builder that transforms SimpleSelectQuery into queries
that return JSON arrays or single JSON objects using PostgreSQL JSON functions.

## Constructors

### Constructor

> **new PostgresJsonQueryBuilder**(): `PostgresJsonQueryBuilder`

Defined in: [packages/core/src/transformers/PostgresJsonQueryBuilder.ts:43](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/PostgresJsonQueryBuilder.ts#L43)

#### Returns

`PostgresJsonQueryBuilder`

## Methods

### buildJsonQuery()

#### Call Signature

> **buildJsonQuery**(`originalQuery`, `mapping`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/PostgresJsonQueryBuilder.ts:124](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/PostgresJsonQueryBuilder.ts#L124)

Build JSON query from original query and mapping configuration.

##### Parameters

###### originalQuery

[`SelectQuery`](../interfaces/SelectQuery.md)

Original query to transform (can be any SelectQuery type)

###### mapping

[`JsonMapping`](../interfaces/JsonMapping.md)

JSON mapping configuration

###### options?

[`QueryBuildOptions`](../interfaces/QueryBuildOptions.md)

##### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

Transformed query with JSON aggregation

#### Call Signature

> **buildJsonQuery**(`originalQuery`, `mapping`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/PostgresJsonQueryBuilder.ts:125](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/PostgresJsonQueryBuilder.ts#L125)

Build JSON query from original query and mapping configuration.

##### Parameters

###### originalQuery

[`SimpleSelectQuery`](SimpleSelectQuery.md)

Original query to transform (can be any SelectQuery type)

###### mapping

[`JsonMapping`](../interfaces/JsonMapping.md)

JSON mapping configuration

###### options?

[`QueryBuildOptions`](../interfaces/QueryBuildOptions.md)

##### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

Transformed query with JSON aggregation

***

### ~~buildJson()~~

> **buildJson**(`originalQuery`, `mapping`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/PostgresJsonQueryBuilder.ts:151](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/PostgresJsonQueryBuilder.ts#L151)

Build JSON query from original query and mapping configuration.

#### Parameters

##### originalQuery

[`SimpleSelectQuery`](SimpleSelectQuery.md)

Original query to transform

##### mapping

[`JsonMapping`](../interfaces/JsonMapping.md)

JSON mapping configuration

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

Transformed query with JSON aggregation

#### Deprecated

Use buildJsonQuery instead. This method will be removed in a future version.
</div>
