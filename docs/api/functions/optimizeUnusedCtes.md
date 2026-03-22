<div v-pre>
# Function: optimizeUnusedCtes()

> **optimizeUnusedCtes**(`query`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:440](https://github.com/mk3008/rawsql-ts/blob/93e13cd77a71b8ce48bfa99c612638e88e31251f/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L440)

Removes unused SELECT-only CTEs from the query when AST references confirm they are never consumed.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
