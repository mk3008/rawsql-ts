<div v-pre>
# Function: optimizeUnusedLeftJoinsToFixedPoint()

> **optimizeUnusedLeftJoinsToFixedPoint**(`query`, `schemaInfo`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:325](https://github.com/mk3008/rawsql-ts/blob/31cf69500e2889c5dc86d8b2391e15e8a0746977/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L325)

Applies the unused left join optimizer until no further joins can be trimmed, ensuring cascading removals stabilize.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

### schemaInfo

[`SchemaInfo`](../type-aliases/SchemaInfo.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
