<div v-pre>
# Function: tableNameVariants()

> **tableNameVariants**(`tableName`): `string`[]

Defined in: [packages/core/src/utils/TableNameUtils.ts:19](https://github.com/mk3008/rawsql-ts/blob/023a375cb53027a6fb9d41c96a4c5d3941054e3d/packages/core/src/utils/TableNameUtils.ts#L19)

For schema-sensitive matching we no longer drop qualifiers; a single
normalized key is sufficient and safer than heuristic variants.

## Parameters

### tableName

`string`

## Returns

`string`[]
</div>
