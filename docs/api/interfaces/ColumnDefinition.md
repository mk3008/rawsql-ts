<div v-pre>
# Interface: ColumnDefinition

Defined in: [packages/core/src/utils/SchemaManager.ts:29](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L29)

Database column metadata for schema mapping

## Extended by

- [`TableColumnDefinitionModel`](TableColumnDefinitionModel.md)

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:31](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L31)

Column name in database

***

### isPrimaryKey?

> `optional` **isPrimaryKey**: `boolean`

Defined in: [packages/core/src/utils/SchemaManager.ts:33](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L33)

Primary key indicator - used for UPDATE/DELETE query WHERE conditions

***

### foreignKey?

> `optional` **foreignKey**: `object`

Defined in: [packages/core/src/utils/SchemaManager.ts:35](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L35)

Foreign key reference

#### table

> **table**: `string`

#### column

> **column**: `string`
</div>
