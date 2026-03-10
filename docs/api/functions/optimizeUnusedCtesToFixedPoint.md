<div v-pre>
# Function: optimizeUnusedCtesToFixedPoint()

> **optimizeUnusedCtesToFixedPoint**(`query`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:448](https://github.com/mk3008/rawsql-ts/blob/02bc18be0db9c3e8793dbcf2912c563c0c84e244/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L448)

Repeatedly prunes unused CTEs until a fixed point is reached so chained removals complete deterministically.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
