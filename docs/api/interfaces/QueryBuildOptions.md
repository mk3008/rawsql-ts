<div v-pre>
# Interface: QueryBuildOptions

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:113](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L113)

Options for dynamic query building

## Properties

### filter?

> `optional` **filter**: [`FilterConditions`](../type-aliases/FilterConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:115](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L115)

Filter conditions to inject into WHERE clause

***

### sort?

> `optional` **sort**: [`SortConditions`](../type-aliases/SortConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:117](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L117)

Sort conditions to inject into ORDER BY clause

***

### paging?

> `optional` **paging**: [`PaginationOptions`](PaginationOptions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:119](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L119)

Pagination options to inject LIMIT/OFFSET clauses

***

### includeColumns?

> `optional` **includeColumns**: `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:124](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L124)

Columns that should remain in the SELECT clause.
When specified, every other column is removed so the output matches this whitelist.

***

### excludeColumns?

> `optional` **excludeColumns**: `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:129](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L129)

Columns that should be removed from the SELECT clause.
Filters apply subtractively and only drop columns that exist in the original output.

***

### serialize?

> `optional` **serialize**: `boolean` \| [`JsonMapping`](JsonMapping.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:135](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L135)

JSON serialization mapping to transform results into hierarchical JSON
- JsonMapping object: explicit mapping configuration
- true: auto-load mapping from corresponding .json file
- false/undefined: no serialization

***

### jsonb?

> `optional` **jsonb**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:141](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L141)

JSONB usage setting. Must be true (default) for PostgreSQL GROUP BY compatibility.
Setting to false will throw an error as JSON type cannot be used in GROUP BY clauses.

#### Default

```ts
true
```

***

### existsStrict?

> `optional` **existsStrict**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:146](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L146)

Throw when column-anchored EXISTS filters fail to resolve.
Defaults to false so invalid definitions are skipped silently.

***

### schemaInfo?

> `optional` **schemaInfo**: [`SchemaInfo`](../type-aliases/SchemaInfo.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:150](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L150)

Schema metadata used when removing unused LEFT JOINs; overrides builder defaults.

***

### removeUnusedLeftJoins?

> `optional` **removeUnusedLeftJoins**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:154](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L154)

Remove unused LEFT JOINs before further processing when schema info is available.

***

### removeUnusedCtes?

> `optional` **removeUnusedCtes**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:159](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L159)

Remove unused Common Table Expressions (CTEs) when they can be safely pruned.
Defaults to false to preserve original WITH definitions.

***

### optionalConditionParameters?

> `optional` **optionalConditionParameters**: [`OptionalConditionPruningParameters`](../type-aliases/OptionalConditionPruningParameters.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:164](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L164)

Explicit opt-in values for truthful optional condition branches in source SQL.
Only listed parameter names are eligible for pruning, and `null`/`undefined` are treated as absent-equivalent.

***

### optionalConditionParameterStates?

> `optional` **optionalConditionParameterStates**: [`OptionalConditionParameterStates`](../type-aliases/OptionalConditionParameterStates.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:169](https://github.com/mk3008/rawsql-ts/blob/b8af36add63fea682bf305ea1eaa342ce61b03bd/packages/core/src/transformers/DynamicQueryBuilder.ts#L169)

Legacy state-map form for optional branch pruning.
Prefer `optionalConditionParameters` for new code so SQL-facing null semantics stay intuitive.
</div>
