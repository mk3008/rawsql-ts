<div v-pre>
# Interface: TableColumnDefinitionModel

Defined in: [packages/core/src/models/TableDefinitionModel.ts:14](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/models/TableDefinitionModel.ts#L14)

Column metadata that augments the SchemaManager definition with
type, nullability, and default information for insert simulation.

## Extends

- [`ColumnDefinition`](ColumnDefinition.md)

## Properties

### typeName?

> `optional` **typeName**: `string`

Defined in: [packages/core/src/models/TableDefinitionModel.ts:16](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/models/TableDefinitionModel.ts#L16)

SQL type that should be used when casting inserted values.

***

### required?

> `optional` **required**: `boolean`

Defined in: [packages/core/src/models/TableDefinitionModel.ts:18](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/models/TableDefinitionModel.ts#L18)

Whether a value is required in the INSERT statement (NOT NULL without default).

***

### defaultValue?

> `optional` **defaultValue**: `null` \| `string` \| [`ValueComponent`](../type-aliases/ValueComponent.md)

Defined in: [packages/core/src/models/TableDefinitionModel.ts:20](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/models/TableDefinitionModel.ts#L20)

Expression text or AST from DDL that represents the column default, if any.

***

### isNotNull?

> `optional` **isNotNull**: `boolean`

Defined in: [packages/core/src/models/TableDefinitionModel.ts:22](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/models/TableDefinitionModel.ts#L22)

Whether the column can accept null values, based on DDL constraints.

***

### name

> **name**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:34](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/utils/SchemaManager.ts#L34)

Column name in database

#### Inherited from

[`ColumnDefinition`](ColumnDefinition.md).[`name`](ColumnDefinition.md#name)

***

### isPrimaryKey?

> `optional` **isPrimaryKey**: `boolean`

Defined in: [packages/core/src/utils/SchemaManager.ts:36](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/utils/SchemaManager.ts#L36)

Primary key indicator - used for UPDATE/DELETE query WHERE conditions

#### Inherited from

[`ColumnDefinition`](ColumnDefinition.md).[`isPrimaryKey`](ColumnDefinition.md#isprimarykey)

***

### foreignKey?

> `optional` **foreignKey**: `object`

Defined in: [packages/core/src/utils/SchemaManager.ts:38](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/utils/SchemaManager.ts#L38)

Foreign key reference

#### table

> **table**: `string`

#### column

> **column**: `string`

#### Inherited from

[`ColumnDefinition`](ColumnDefinition.md).[`foreignKey`](ColumnDefinition.md#foreignkey)

***

### jsonAlias?

> `optional` **jsonAlias**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:43](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/utils/SchemaManager.ts#L43)

Alias for JSON output (useful for avoiding conflicts)

#### Inherited from

[`ColumnDefinition`](ColumnDefinition.md).[`jsonAlias`](ColumnDefinition.md#jsonalias)
</div>
