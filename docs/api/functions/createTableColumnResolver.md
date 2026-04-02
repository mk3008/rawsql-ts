<div v-pre>
# Function: createTableColumnResolver()

> **createTableColumnResolver**(`schemas`): (`tableName`) => `string`[]

Defined in: [packages/core/src/utils/SchemaManager.ts:280](https://github.com/mk3008/rawsql-ts/blob/4a96cf12a5c3e5c2ca1c2e1e88ff01abcf60f29c/packages/core/src/utils/SchemaManager.ts#L280)

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
