<div v-pre>
# Interface: AliasScope

Defined in: [packages/core/src/transformers/AliasRenamer.ts:15](https://github.com/mk3008/rawsql-ts/blob/a3f396a2c74f506b11c5fb5f852c6172b759da68/packages/core/src/transformers/AliasRenamer.ts#L15)

Represents an alias scope within SQL query structure

## Properties

### type

> **type**: `"cte"` \| `"subquery"` \| `"main"`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:16](https://github.com/mk3008/rawsql-ts/blob/a3f396a2c74f506b11c5fb5f852c6172b759da68/packages/core/src/transformers/AliasRenamer.ts#L16)

***

### name?

> `optional` **name**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:17](https://github.com/mk3008/rawsql-ts/blob/a3f396a2c74f506b11c5fb5f852c6172b759da68/packages/core/src/transformers/AliasRenamer.ts#L17)

***

### query

> **query**: [`SelectQuery`](SelectQuery.md)

Defined in: [packages/core/src/transformers/AliasRenamer.ts:18](https://github.com/mk3008/rawsql-ts/blob/a3f396a2c74f506b11c5fb5f852c6172b759da68/packages/core/src/transformers/AliasRenamer.ts#L18)

***

### startPosition

> **startPosition**: `number`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:19](https://github.com/mk3008/rawsql-ts/blob/a3f396a2c74f506b11c5fb5f852c6172b759da68/packages/core/src/transformers/AliasRenamer.ts#L19)

***

### endPosition

> **endPosition**: `number`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:20](https://github.com/mk3008/rawsql-ts/blob/a3f396a2c74f506b11c5fb5f852c6172b759da68/packages/core/src/transformers/AliasRenamer.ts#L20)
</div>
