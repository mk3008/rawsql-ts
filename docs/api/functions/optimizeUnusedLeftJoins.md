<div v-pre>
# Function: optimizeUnusedLeftJoins()

> **optimizeUnusedLeftJoins**(`query`, `schemaInfo`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:317](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L317)

Removes LEFT JOIN clauses from the provided query when AST references prove the join target is unused and schema metadata certifies the join column is unique.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

### schemaInfo

[`SchemaInfo`](../type-aliases/SchemaInfo.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
