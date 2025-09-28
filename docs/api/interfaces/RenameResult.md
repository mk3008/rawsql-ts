<div v-pre>
# Interface: RenameResult

Defined in: [packages/core/src/transformers/AliasRenamer.ts:44](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L44)

Result of alias renaming operation

## Properties

### success

> **success**: `boolean`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:45](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L45)

***

### originalSql

> **originalSql**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:46](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L46)

***

### newSql?

> `optional` **newSql**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:47](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L47)

***

### changes

> **changes**: [`AliasChange`](AliasChange.md)[]

Defined in: [packages/core/src/transformers/AliasRenamer.ts:48](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L48)

***

### conflicts?

> `optional` **conflicts**: `string`[]

Defined in: [packages/core/src/transformers/AliasRenamer.ts:49](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L49)

***

### scope?

> `optional` **scope**: [`AliasScope`](AliasScope.md)

Defined in: [packages/core/src/transformers/AliasRenamer.ts:50](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/AliasRenamer.ts#L50)
</div>
