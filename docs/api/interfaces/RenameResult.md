<div v-pre>
# Interface: RenameResult

Defined in: [packages/core/src/transformers/AliasRenamer.ts:45](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/AliasRenamer.ts#L45)

Result of alias renaming operation

## Properties

### success

> **success**: `boolean`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:46](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/AliasRenamer.ts#L46)

***

### originalSql

> **originalSql**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:47](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/AliasRenamer.ts#L47)

***

### newSql?

> `optional` **newSql**: `string`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:48](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/AliasRenamer.ts#L48)

***

### changes

> **changes**: [`AliasChange`](AliasChange.md)[]

Defined in: [packages/core/src/transformers/AliasRenamer.ts:49](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/AliasRenamer.ts#L49)

***

### conflicts?

> `optional` **conflicts**: `string`[]

Defined in: [packages/core/src/transformers/AliasRenamer.ts:50](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/AliasRenamer.ts#L50)

***

### scope?

> `optional` **scope**: [`AliasScope`](AliasScope.md)

Defined in: [packages/core/src/transformers/AliasRenamer.ts:51](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/AliasRenamer.ts#L51)
</div>
