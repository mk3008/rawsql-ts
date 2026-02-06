<div v-pre>
# Function: optimizeUnusedLeftJoins()

> **optimizeUnusedLeftJoins**(`query`, `schemaInfo`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:317](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L317)

Removes LEFT JOIN clauses from the provided query when AST references prove the join target is unused and schema metadata certifies the join column is unique.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

### schemaInfo

[`SchemaInfo`](../type-aliases/SchemaInfo.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
