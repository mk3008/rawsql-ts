<div v-pre>
# Function: collectSupportedOptionalConditionBranches()

> **collectSupportedOptionalConditionBranches**(`query`): [`SupportedOptionalConditionBranch`](../interfaces/SupportedOptionalConditionBranch.md)[]

Defined in: [packages/core/src/transformers/PruneOptionalConditionBranches.ts:380](https://github.com/mk3008/rawsql-ts/blob/4a96cf12a5c3e5c2ca1c2e1e88ff01abcf60f29c/packages/core/src/transformers/PruneOptionalConditionBranches.ts#L380)

Collects supported top-level optional condition branches from the query graph.
The returned branch expressions keep object identity so callers can move them without re-rendering.

## Parameters

### query

[`SelectQuery`](../interfaces/SelectQuery.md)

## Returns

[`SupportedOptionalConditionBranch`](../interfaces/SupportedOptionalConditionBranch.md)[]
</div>
