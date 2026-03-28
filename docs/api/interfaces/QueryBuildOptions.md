<div v-pre>
# Interface: QueryBuildOptions

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:108](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L108)

Options for dynamic query building

## Properties

### filter?

> `optional` **filter**: [`FilterConditions`](../type-aliases/FilterConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:113](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L113)

Legacy filter input for named-parameter binding only.
Dynamic predicate injection is no longer supported and will fail fast.

***

### sort?

> `optional` **sort**: [`SortConditions`](../type-aliases/SortConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:115](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L115)

Sort conditions to inject into ORDER BY clause

***

### paging?

> `optional` **paging**: [`PaginationOptions`](PaginationOptions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:117](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L117)

Pagination options to inject LIMIT/OFFSET clauses

***

### includeColumns?

> `optional` **includeColumns**: `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:122](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L122)

Columns that should remain in the SELECT clause.
When specified, every other column is removed so the output matches this whitelist.

***

### excludeColumns?

> `optional` **excludeColumns**: `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:127](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L127)

Columns that should be removed from the SELECT clause.
Filters apply subtractively and only drop columns that exist in the original output.

***

### serialize?

> `optional` **serialize**: `boolean` \| [`JsonMapping`](JsonMapping.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:133](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L133)

JSON serialization mapping to transform results into hierarchical JSON
- JsonMapping object: explicit mapping configuration
- true: auto-load mapping from corresponding .json file
- false/undefined: no serialization

***

### jsonb?

> `optional` **jsonb**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:139](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L139)

JSONB usage setting. Must be true (default) for PostgreSQL GROUP BY compatibility.
Setting to false will throw an error as JSON type cannot be used in GROUP BY clauses.

#### Default

```ts
true
```

***

### existsStrict?

> `optional` **existsStrict**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:144](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L144)

Throw when column-anchored EXISTS filters fail to resolve.
Defaults to false so invalid definitions are skipped silently.

***

### schemaInfo?

> `optional` **schemaInfo**: [`SchemaInfo`](../type-aliases/SchemaInfo.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:148](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L148)

Schema metadata used when removing unused LEFT JOINs; overrides builder defaults.

***

### removeUnusedLeftJoins?

> `optional` **removeUnusedLeftJoins**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:152](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L152)

Remove unused LEFT JOINs before further processing when schema info is available.

***

### removeUnusedCtes?

> `optional` **removeUnusedCtes**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:157](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L157)

Remove unused Common Table Expressions (CTEs) when they can be safely pruned.
Defaults to false to preserve original WITH definitions.

***

### optionalConditionParameters?

> `optional` **optionalConditionParameters**: [`OptionalConditionPruningParameters`](../type-aliases/OptionalConditionPruningParameters.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:162](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L162)

Explicit opt-in values for truthful optional condition branches in source SQL.
Only listed parameter names are eligible for pruning, and `null`/`undefined` are treated as absent-equivalent.

***

### optionalConditionParameterStates?

> `optional` **optionalConditionParameterStates**: [`OptionalConditionParameterStates`](../type-aliases/OptionalConditionParameterStates.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:167](https://github.com/mk3008/rawsql-ts/blob/0b02b1f6136444853a745ebd2678719e3251db71/packages/core/src/transformers/DynamicQueryBuilder.ts#L167)

Legacy state-map form for optional branch pruning.
Prefer `optionalConditionParameters` for new code so SQL-facing null semantics stay intuitive.
</div>
