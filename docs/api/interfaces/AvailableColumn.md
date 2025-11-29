<div v-pre>
# Interface: AvailableColumn

Defined in: [packages/core/src/utils/ScopeResolver.ts:45](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/utils/ScopeResolver.ts#L45)

Information about columns available for a specific table

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:47](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/utils/ScopeResolver.ts#L47)

Column name

***

### tableName

> **tableName**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:49](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/utils/ScopeResolver.ts#L49)

Table name the column belongs to

***

### tableAlias?

> `optional` **tableAlias**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:51](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/utils/ScopeResolver.ts#L51)

Table alias (if any)

***

### type?

> `optional` **type**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:53](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/utils/ScopeResolver.ts#L53)

Data type (if known)

***

### nullable?

> `optional` **nullable**: `boolean`

Defined in: [packages/core/src/utils/ScopeResolver.ts:55](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/utils/ScopeResolver.ts#L55)

Whether column is nullable

***

### fullReference

> **fullReference**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:57](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/utils/ScopeResolver.ts#L57)

Full qualified column reference
</div>
