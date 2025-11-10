<div v-pre>
# Class: SchemaManager

Defined in: [packages/core/src/utils/SchemaManager.ts:87](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/utils/SchemaManager.ts#L87)

Central schema management utility for rawsql-ts
Converts user-defined schemas to various internal formats

## Constructors

### Constructor

> **new SchemaManager**(`schemas`): `SchemaManager`

Defined in: [packages/core/src/utils/SchemaManager.ts:90](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/utils/SchemaManager.ts#L90)

#### Parameters

##### schemas

[`SchemaRegistry`](../interfaces/SchemaRegistry.md)

#### Returns

`SchemaManager`

## Methods

### getTableColumns()

> **getTableColumns**(`tableName`): `string`[]

Defined in: [packages/core/src/utils/SchemaManager.ts:133](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/utils/SchemaManager.ts#L133)

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

Defined in: [packages/core/src/utils/SchemaManager.ts:145](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/utils/SchemaManager.ts#L145)

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

### createJsonMapping()

> **createJsonMapping**(`rootTableName`): [`JsonMapping`](../interfaces/JsonMapping.md)

Defined in: [packages/core/src/utils/SchemaManager.ts:154](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/utils/SchemaManager.ts#L154)

Generate JSON mapping configuration for PostgresJsonQueryBuilder

#### Parameters

##### rootTableName

`string`

Root table for the JSON structure

#### Returns

[`JsonMapping`](../interfaces/JsonMapping.md)

JSON mapping configuration

***

### getTableNames()

> **getTableNames**(): `string`[]

Defined in: [packages/core/src/utils/SchemaManager.ts:210](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/utils/SchemaManager.ts#L210)

Get all table names in the schema

#### Returns

`string`[]

Array of table names

***

### getTable()

> **getTable**(`tableName`): `undefined` \| [`TableDefinition`](../interfaces/TableDefinition.md)

Defined in: [packages/core/src/utils/SchemaManager.ts:219](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/utils/SchemaManager.ts#L219)

Get table definition by name

#### Parameters

##### tableName

`string`

Name of the table

#### Returns

`undefined` \| [`TableDefinition`](../interfaces/TableDefinition.md)

Table definition or undefined

***

### getPrimaryKey()

> **getPrimaryKey**(`tableName`): `undefined` \| `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:229](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/utils/SchemaManager.ts#L229)

Get primary key column name for a table
Used by QueryBuilder.buildUpdateQuery for WHERE clause conditions

#### Parameters

##### tableName

`string`

Name of the table

#### Returns

`undefined` \| `string`

Primary key column name or undefined

***

### getForeignKeys()

> **getForeignKeys**(`tableName`): `object`[]

Defined in: [packages/core/src/utils/SchemaManager.ts:244](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/utils/SchemaManager.ts#L244)

Get foreign key relationships for a table

#### Parameters

##### tableName

`string`

Name of the table

#### Returns

`object`[]

Array of foreign key relationships
</div>
