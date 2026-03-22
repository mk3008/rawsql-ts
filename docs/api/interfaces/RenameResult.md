<div v-pre>
# Interface: RenameResult

Defined in: [packages/core/src/transformers/AliasRenamer.ts:45](https://github.com/mk3008/rawsql-ts/blob/efd33da9a02be68ec71c71191ea27d47aff097ce/packages/core/src/transformers/AliasRenamer.ts#L45)

Result of alias renaming operation

## Properties

### success

> **success**: `boolean`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:46](https://github.com/mk3008/rawsql-ts/blob/efd33da9a02be68ec71c71191ea27d47aff097ce/packages/core/src/transformers/AliasRenamer.ts#L46)

***

### originalSql

> **originalSql**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:47](https://github.com/mk3008/rawsql-ts/blob/efd33da9a02be68ec71c71191ea27d47aff097ce/packages/core/src/transformers/AliasRenamer.ts#L47)

***

### newSql?

> `optional` **newSql**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:48](https://github.com/mk3008/rawsql-ts/blob/efd33da9a02be68ec71c71191ea27d47aff097ce/packages/core/src/transformers/AliasRenamer.ts#L48)

***

### changes

> **changes**: [`AliasChange`](AliasChange.md)[]

Defined in: [packages/core/src/transformers/AliasRenamer.ts:49](https://github.com/mk3008/rawsql-ts/blob/efd33da9a02be68ec71c71191ea27d47aff097ce/packages/core/src/transformers/AliasRenamer.ts#L49)

***

### conflicts?

> `optional` **conflicts**: `string`[]

Defined in: [packages/core/src/transformers/AliasRenamer.ts:50](https://github.com/mk3008/rawsql-ts/blob/efd33da9a02be68ec71c71191ea27d47aff097ce/packages/core/src/transformers/AliasRenamer.ts#L50)

***

### scope?

> `optional` **scope**: [`AliasScope`](AliasScope.md)

Defined in: [packages/core/src/transformers/AliasRenamer.ts:51](https://github.com/mk3008/rawsql-ts/blob/efd33da9a02be68ec71c71191ea27d47aff097ce/packages/core/src/transformers/AliasRenamer.ts#L51)
</div>
