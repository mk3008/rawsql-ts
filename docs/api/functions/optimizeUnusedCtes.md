<div v-pre>
# Function: optimizeUnusedCtes()

> **optimizeUnusedCtes**(`query`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:440](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L440)

Removes unused SELECT-only CTEs from the query when AST references confirm they are never consumed.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
