<div v-pre>
# Function: optimizeUnusedLeftJoinsToFixedPoint()

> **optimizeUnusedLeftJoinsToFixedPoint**(`query`, `schemaInfo`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/OptimizeUnusedLeftJoins.ts:325](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/transformers/OptimizeUnusedLeftJoins.ts#L325)

Applies the unused left join optimizer until no further joins can be trimmed, ensuring cascading removals stabilize.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

### schemaInfo

[`SchemaInfo`](../type-aliases/SchemaInfo.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
