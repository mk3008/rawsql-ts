<div v-pre>
# Interface: RenameResult

Defined in: [packages/core/src/transformers/AliasRenamer.ts:45](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/AliasRenamer.ts#L45)

Result of alias renaming operation

## Properties

### success

> **success**: `boolean`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:46](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/AliasRenamer.ts#L46)

***

### originalSql

> **originalSql**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:47](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/AliasRenamer.ts#L47)

***

### newSql?

> `optional` **newSql**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:48](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/AliasRenamer.ts#L48)

***

### changes

> **changes**: [`AliasChange`](AliasChange.md)[]

Defined in: [packages/core/src/transformers/AliasRenamer.ts:49](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/AliasRenamer.ts#L49)

***

### conflicts?

> `optional` **conflicts**: `string`[]

Defined in: [packages/core/src/transformers/AliasRenamer.ts:50](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/AliasRenamer.ts#L50)

***

### scope?

> `optional` **scope**: [`AliasScope`](AliasScope.md)

Defined in: [packages/core/src/transformers/AliasRenamer.ts:51](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/AliasRenamer.ts#L51)
</div>
