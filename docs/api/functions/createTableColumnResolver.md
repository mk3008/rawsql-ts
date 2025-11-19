<div v-pre>
# Function: createTableColumnResolver()

> **createTableColumnResolver**(`schemas`): (`tableName`) => `string`[]

Defined in: [packages/core/src/utils/SchemaManager.ts:280](https://github.com/mk3008/rawsql-ts/blob/4ed5433376f3d2e35a68a48a1db4b0391ec65db1/packages/core/src/utils/SchemaManager.ts#L280)

Create TableColumnResolver function from schema definitions

## Parameters

### schemas

[`SchemaRegistry`](../interfaces/SchemaRegistry.md)

Schema registry object

## Returns

TableColumnResolver function for SqlParamInjector

> (`tableName`): `string`[]

### Parameters

#### tableName

`string`

### Returns

`string`[]
</div>
