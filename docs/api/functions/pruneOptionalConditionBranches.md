<div v-pre>
# Function: pruneOptionalConditionBranches()

> **pruneOptionalConditionBranches**(`query`, `pruningParameters`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/PruneOptionalConditionBranches.ts:279](https://github.com/mk3008/rawsql-ts/blob/937a4369243f31d8023c43a12f0889feef178efd/packages/core/src/transformers/PruneOptionalConditionBranches.ts#L279)

Prunes supported optional WHERE branches when an explicitly targeted parameter is absent-equivalent.
For the MVP, only `null` and `undefined` are treated as absent and unsupported shapes remain exact no-op.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

### pruningParameters

[`OptionalConditionPruningParameters`](../type-aliases/OptionalConditionPruningParameters.md)

## Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
