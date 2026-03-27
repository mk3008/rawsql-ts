<div v-pre>
# Function: tableNameVariants()

> **tableNameVariants**(`tableName`): `string`[]

Defined in: [packages/core/src/utils/TableNameUtils.ts:19](https://github.com/mk3008/rawsql-ts/blob/2205890b4ad14cdd6f006dd2c83aff89c3062b76/packages/core/src/utils/TableNameUtils.ts#L19)

For schema-sensitive matching we no longer drop qualifiers; a single
normalized key is sufficient and safer than heuristic variants.

## Parameters

### tableName

`string`

## Returns

`string`[]
</div>
