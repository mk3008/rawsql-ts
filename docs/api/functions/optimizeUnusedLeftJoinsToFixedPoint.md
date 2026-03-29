<div v-pre>
# Function: optimizeUnusedLeftJoinsToFixedPoint()

> **optimizeUnusedLeftJoinsToFixedPoint**(`query`, `schemaInfo`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:325](https://github.com/mk3008/rawsql-ts/blob/d48ef1e4aa20926f9b07d25e21de5be68d0d6807/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L325)

Applies the unused left join optimizer until no further joins can be trimmed, ensuring cascading removals stabilize.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

### schemaInfo

[`SchemaInfo`](../type-aliases/SchemaInfo.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
