<div v-pre>
# Function: optimizeUnusedLeftJoins()

> **optimizeUnusedLeftJoins**(`query`, `schemaInfo`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:317](https://github.com/mk3008/rawsql-ts/blob/e7e8feb36e790d0bdcd09fe2915fd3f87fd0aef4/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L317)

Removes LEFT JOIN clauses from the provided query when AST references prove the join target is unused and schema metadata certifies the join column is unique.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

### schemaInfo

[`SchemaInfo`](../type-aliases/SchemaInfo.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
