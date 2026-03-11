<div v-pre>
# Function: optimizeUnusedCtes()

> **optimizeUnusedCtes**(`query`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:440](https://github.com/mk3008/rawsql-ts/blob/fc32859e213253213dbd6475b28d3ce035220033/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L440)

Removes unused SELECT-only CTEs from the query when AST references confirm they are never consumed.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
