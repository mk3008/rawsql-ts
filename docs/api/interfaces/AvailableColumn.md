<div v-pre>
# Interface: AvailableColumn

Defined in: [packages/core/src/utils/ScopeResolver.ts:46](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/utils/ScopeResolver.ts#L46)

Information about columns available for a specific table

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:48](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/utils/ScopeResolver.ts#L48)

Column name

***

### tableName

> **tableName**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:50](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/utils/ScopeResolver.ts#L50)

Table name the column belongs to

***

### tableAlias?

> `optional` **tableAlias**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:52](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/utils/ScopeResolver.ts#L52)

Table alias (if any)

***

### type?

> `optional` **type**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:54](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/utils/ScopeResolver.ts#L54)

Data type (if known)

***

### nullable?

> `optional` **nullable**: `boolean`

Defined in: [packages/core/src/utils/ScopeResolver.ts:56](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/utils/ScopeResolver.ts#L56)

Whether column is nullable

***

### fullReference

> **fullReference**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:58](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/utils/ScopeResolver.ts#L58)

Full qualified column reference
</div>
