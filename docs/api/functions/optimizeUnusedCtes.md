<div v-pre>
# Function: optimizeUnusedCtes()

> **optimizeUnusedCtes**(`query`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:440](https://github.com/mk3008/rawsql-ts/blob/946ac2fd798706150332136ae589a721c543d619/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L440)

Removes unused SELECT-only CTEs from the query when AST references confirm they are never consumed.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
