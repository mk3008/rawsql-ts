<div v-pre>
# Function: tableNameVariants()

> **tableNameVariants**(`tableName`): `string`[]

Defined in: [packages/core/src/utils/TableNameUtils.ts:19](https://github.com/mk3008/rawsql-ts/blob/a3f396a2c74f506b11c5fb5f852c6172b759da68/packages/core/src/utils/TableNameUtils.ts#L19)

For schema-sensitive matching we no longer drop qualifiers; a single
normalized key is sufficient and safer than heuristic variants.

## Parameters

### tableName

`string`

## Returns

`string`[]
</div>
