<div v-pre>
# Class: SqlSortInjector

Defined in: [packages/core/src/transformers/SqlSortInjector.ts:11](https://github.com/mk3008/rawsql-ts/blob/ad9e3f7c443de1bfaed91c626050a5296e016ab4/packages/core/src/transformers/SqlSortInjector.ts#L11)

SqlSortInjector injects sort conditions into a SelectQuery model,
creating ORDER BY clauses based on provided sort conditions.

## Constructors

### Constructor

> **new SqlSortInjector**(`tableColumnResolver?`): `SqlSortInjector`

Defined in: [packages/core/src/transformers/SqlSortInjector.ts:14](https://github.com/mk3008/rawsql-ts/blob/ad9e3f7c443de1bfaed91c626050a5296e016ab4/packages/core/src/transformers/SqlSortInjector.ts#L14)

#### Parameters

##### tableColumnResolver?

(`tableName`) => `string`[]

#### Returns

`SqlSortInjector`

## Methods

### removeOrderBy()

> `static` **removeOrderBy**(`query`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/SqlSortInjector.ts:23](https://github.com/mk3008/rawsql-ts/blob/ad9e3f7c443de1bfaed91c626050a5296e016ab4/packages/core/src/transformers/SqlSortInjector.ts#L23)

Removes ORDER BY clause from the given query.

#### Parameters

##### query

The SelectQuery to modify

`string` | [`SimpleSelectQuery`](SimpleSelectQuery.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

The modified SimpleSelectQuery with ORDER BY clause removed

***

### inject()

> **inject**(`query`, `sortConditions`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/SqlSortInjector.ts:58](https://github.com/mk3008/rawsql-ts/blob/ad9e3f7c443de1bfaed91c626050a5296e016ab4/packages/core/src/transformers/SqlSortInjector.ts#L58)

Injects sort conditions as ORDER BY clauses into the given query model.
Appends to existing ORDER BY clause if present.

#### Parameters

##### query

The SelectQuery to modify

`string` | [`SimpleSelectQuery`](SimpleSelectQuery.md)

##### sortConditions

[`SortConditions`](../type-aliases/SortConditions.md)

A record of column names and sort conditions

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

The modified SimpleSelectQuery
</div>
