<div v-pre>
# Class: SchemaManager

Defined in: [packages/core/src/utils/SchemaManager.ts:82](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L82)

Central schema management utility for rawsql-ts
Converts user-defined schemas to resolvers consumed by schema-aware utilities

## Constructors

### Constructor

> **new SchemaManager**(`schemas`): `SchemaManager`

Defined in: [packages/core/src/utils/SchemaManager.ts:85](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L85)

#### Parameters

##### schemas

[`SchemaRegistry`](../interfaces/SchemaRegistry.md)

#### Returns

`SchemaManager`

## Methods

### getTableColumns()

> **getTableColumns**(`tableName`): `string`[]

Defined in: [packages/core/src/utils/SchemaManager.ts:128](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L128)

Get table column names for SqlParamInjector TableColumnResolver

#### Parameters

##### tableName

`string`

Name of the table

#### Returns

`string`[]

Array of column names

***

### createTableColumnResolver()

> **createTableColumnResolver**(): (`tableName`) => `string`[]

Defined in: [packages/core/src/utils/SchemaManager.ts:140](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L140)

Create TableColumnResolver function for SqlParamInjector

#### Returns

Function compatible with SqlParamInjector

> (`tableName`): `string`[]

##### Parameters

###### tableName

`string`

##### Returns

`string`[]

***

### getTableNames()

> **getTableNames**(): `string`[]

Defined in: [packages/core/src/utils/SchemaManager.ts:148](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L148)

Get all table names in the schema

#### Returns

`string`[]

Array of table names

***

### getTable()

> **getTable**(`tableName`): [`TableDefinition`](../interfaces/TableDefinition.md) \| `undefined`

Defined in: [packages/core/src/utils/SchemaManager.ts:157](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L157)

Get table definition by name

#### Parameters

##### tableName

`string`

Name of the table

#### Returns

[`TableDefinition`](../interfaces/TableDefinition.md) \| `undefined`

Table definition or undefined

***

### getPrimaryKey()

> **getPrimaryKey**(`tableName`): `string` \| `undefined`

Defined in: [packages/core/src/utils/SchemaManager.ts:167](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L167)

Get primary key column name for a table
Used by QueryBuilder.buildUpdateQuery for WHERE clause conditions

#### Parameters

##### tableName

`string`

Name of the table

#### Returns

`string` \| `undefined`

Primary key column name or undefined

***

### getForeignKeys()

> **getForeignKeys**(`tableName`): `object`[]

Defined in: [packages/core/src/utils/SchemaManager.ts:182](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L182)

Get foreign key relationships for a table

#### Parameters

##### tableName

`string`

Name of the table

#### Returns

`object`[]

Array of foreign key relationships
</div>
