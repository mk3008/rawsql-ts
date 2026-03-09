<div v-pre>
# Function: optimizeUnusedCtesToFixedPoint()

> **optimizeUnusedCtesToFixedPoint**(`query`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:448](https://github.com/mk3008/rawsql-ts/blob/e47de32e313adcf06c69ad7b1df066cc7b33c2d2/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L448)

Repeatedly prunes unused CTEs until a fixed point is reached so chained removals complete deterministically.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
