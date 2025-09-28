<div v-pre>
# Interface: AliasScope

Defined in: [packages/core/src/transformers/AliasRenamer.ts:14](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L14)

Represents an alias scope within SQL query structure

## Properties

### type

> **type**: `"cte"` \| `"subquery"` \| `"main"`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:15](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L15)

***

### name?

> `optional` **name**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:16](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L16)

***

### query

> **query**: [`SelectQuery`](SelectQuery.md)

Defined in: [packages/core/src/transformers/AliasRenamer.ts:17](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L17)

***

### startPosition

> **startPosition**: `number`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:18](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L18)

***

### endPosition

> **endPosition**: `number`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:19](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L19)
</div>
