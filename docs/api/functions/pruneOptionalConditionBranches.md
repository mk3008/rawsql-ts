<div v-pre>
# Function: pruneOptionalConditionBranches()

> **pruneOptionalConditionBranches**(`query`, `pruningParameters`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/PruneOptionalConditionBranches.ts:279](https://github.com/mk3008/rawsql-ts/blob/54335acf95e92a53b59952bdcbd87976eeeb5d3f/packages/core/src/transformers/PruneOptionalConditionBranches.ts#L279)

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
