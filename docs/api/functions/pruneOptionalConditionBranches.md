<div v-pre>
# Function: pruneOptionalConditionBranches()

> **pruneOptionalConditionBranches**(`query`, `pruningParameters`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/PruneOptionalConditionBranches.ts:364](https://github.com/mk3008/rawsql-ts/blob/2205890b4ad14cdd6f006dd2c83aff89c3062b76/packages/core/src/transformers/PruneOptionalConditionBranches.ts#L364)

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
