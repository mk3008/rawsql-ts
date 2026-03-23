<div v-pre>
# Function: createTableColumnResolver()

> **createTableColumnResolver**(`schemas`): (`tableName`) => `string`[]

Defined in: [packages/core/src/utils/SchemaManager.ts:280](https://github.com/mk3008/rawsql-ts/blob/9a43510a16e39bf2c2a913e6d2e5ec12b36391e6/packages/core/src/utils/SchemaManager.ts#L280)

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
