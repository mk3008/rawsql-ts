<div v-pre>
# Function: optimizeUnusedCtes()

> **optimizeUnusedCtes**(`query`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:440](https://github.com/mk3008/rawsql-ts/blob/efd33da9a02be68ec71c71191ea27d47aff097ce/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L440)

Removes unused SELECT-only CTEs from the query when AST references confirm they are never consumed.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
