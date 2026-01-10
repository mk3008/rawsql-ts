<div v-pre>
# Function: createTableColumnResolver()

> **createTableColumnResolver**(`schemas`): (`tableName`) => `string`[]

Defined in: [packages/core/src/utils/SchemaManager.ts:280](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/utils/SchemaManager.ts#L280)

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
