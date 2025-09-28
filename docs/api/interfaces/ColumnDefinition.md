<div v-pre>
# Interface: ColumnDefinition

Defined in: [packages/core/src/utils/SchemaManager.ts:32](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/SchemaManager.ts#L32)

Database column metadata for schema mapping

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:34](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/SchemaManager.ts#L34)

Column name in database

***

### isPrimaryKey?

> `optional` **isPrimaryKey**: `boolean`

Defined in: [packages/core/src/utils/SchemaManager.ts:36](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/SchemaManager.ts#L36)

Primary key indicator - used for UPDATE/DELETE query WHERE conditions

***

### foreignKey?

> `optional` **foreignKey**: `object`

Defined in: [packages/core/src/utils/SchemaManager.ts:38](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/SchemaManager.ts#L38)

Foreign key reference

#### table

> **table**: `string`

#### column

> **column**: `string`

***

### jsonAlias?

> `optional` **jsonAlias**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:43](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/SchemaManager.ts#L43)

Alias for JSON output (useful for avoiding conflicts)
</div>
