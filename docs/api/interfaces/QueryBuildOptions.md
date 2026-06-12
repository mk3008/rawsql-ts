<div v-pre>
# Interface: QueryBuildOptions

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:107](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L107)

Options for dynamic query building

## Properties

### filter?

> `optional` **filter**: [`FilterConditions`](../type-aliases/FilterConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:112](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L112)

Legacy filter input for named-parameter binding only.
Dynamic predicate injection is no longer supported and will fail fast.

***

### sort?

> `optional` **sort**: [`SortConditions`](../type-aliases/SortConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:114](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L114)

Sort conditions to inject into ORDER BY clause

***

### paging?

> `optional` **paging**: [`PaginationOptions`](PaginationOptions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:116](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L116)

Pagination options to inject LIMIT/OFFSET clauses

***

### includeColumns?

> `optional` **includeColumns**: `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:121](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L121)

Columns that should remain in the SELECT clause.
When specified, every other column is removed so the output matches this whitelist.

***

### excludeColumns?

> `optional` **excludeColumns**: `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:126](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L126)

Columns that should be removed from the SELECT clause.
Filters apply subtractively and only drop columns that exist in the original output.

***

### existsStrict?

> `optional` **existsStrict**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:131](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L131)

Throw when column-anchored EXISTS filters fail to resolve.
Defaults to false so invalid definitions are skipped silently.

***

### schemaInfo?

> `optional` **schemaInfo**: [`SchemaInfo`](../type-aliases/SchemaInfo.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:135](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L135)

Schema metadata used when removing unused LEFT JOINs; overrides builder defaults.

***

### removeUnusedLeftJoins?

> `optional` **removeUnusedLeftJoins**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:139](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L139)

Remove unused LEFT JOINs before further processing when schema info is available.

***

### removeUnusedCtes?

> `optional` **removeUnusedCtes**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:144](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L144)

Remove unused Common Table Expressions (CTEs) when they can be safely pruned.
Defaults to false to preserve original WITH definitions.

***

### optionalConditionParameters?

> `optional` **optionalConditionParameters**: [`OptionalConditionPruningParameters`](../type-aliases/OptionalConditionPruningParameters.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:149](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L149)

Explicit opt-in values for truthful optional condition branches in source SQL.
Only listed parameter names are eligible for pruning, and `null`/`undefined` are treated as absent-equivalent.

***

### optionalConditionParameterStates?

> `optional` **optionalConditionParameterStates**: [`OptionalConditionParameterStates`](../type-aliases/OptionalConditionParameterStates.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:154](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/DynamicQueryBuilder.ts#L154)

Legacy state-map form for optional branch pruning.
Prefer `optionalConditionParameters` for new code so SQL-facing null semantics stay intuitive.
</div>
