<div v-pre>
# Function: tableNameVariants()

> **tableNameVariants**(`tableName`): `string`[]

Defined in: [packages/core/src/utils/TableNameUtils.ts:19](https://github.com/mk3008/rawsql-ts/blob/1af371e77f92414f10e9ef00ffbf5a544037fea3/packages/core/src/utils/TableNameUtils.ts#L19)

For schema-sensitive matching we no longer drop qualifiers; a single
normalized key is sufficient and safer than heuristic variants.

## Parameters

### tableName

`string`

## Returns

`string`[]
</div>
