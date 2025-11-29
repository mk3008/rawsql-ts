<div v-pre>
# Interface: RenameResult

Defined in: [packages/core/src/transformers/AliasRenamer.ts:44](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/AliasRenamer.ts#L44)

Result of alias renaming operation

## Properties

### success

> **success**: `boolean`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:45](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/AliasRenamer.ts#L45)

***

### originalSql

> **originalSql**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:46](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/AliasRenamer.ts#L46)

***

### newSql?

> `optional` **newSql**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:47](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/AliasRenamer.ts#L47)

***

### changes

> **changes**: [`AliasChange`](AliasChange.md)[]

Defined in: [packages/core/src/transformers/AliasRenamer.ts:48](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/AliasRenamer.ts#L48)

***

### conflicts?

> `optional` **conflicts**: `string`[]

Defined in: [packages/core/src/transformers/AliasRenamer.ts:49](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/AliasRenamer.ts#L49)

***

### scope?

> `optional` **scope**: [`AliasScope`](AliasScope.md)

Defined in: [packages/core/src/transformers/AliasRenamer.ts:50](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/AliasRenamer.ts#L50)
</div>
