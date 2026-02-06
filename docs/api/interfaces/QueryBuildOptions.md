<div v-pre>
# Interface: QueryBuildOptions

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:108](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L108)

Options for dynamic query building

## Properties

### filter?

> `optional` **filter**: [`FilterConditions`](../type-aliases/FilterConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:110](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L110)

Filter conditions to inject into WHERE clause

***

### sort?

> `optional` **sort**: [`SortConditions`](../type-aliases/SortConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:112](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L112)

Sort conditions to inject into ORDER BY clause

***

### paging?

> `optional` **paging**: [`PaginationOptions`](PaginationOptions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:114](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L114)

Pagination options to inject LIMIT/OFFSET clauses

***

### includeColumns?

> `optional` **includeColumns**: `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:119](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L119)

Columns that should remain in the SELECT clause.
When specified, every other column is removed so the output matches this whitelist.

***

### excludeColumns?

> `optional` **excludeColumns**: `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:124](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L124)

Columns that should be removed from the SELECT clause.
Filters apply subtractively and only drop columns that exist in the original output.

***

### serialize?

> `optional` **serialize**: `boolean` \| [`JsonMapping`](JsonMapping.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:130](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L130)

JSON serialization mapping to transform results into hierarchical JSON
- JsonMapping object: explicit mapping configuration
- true: auto-load mapping from corresponding .json file
- false/undefined: no serialization

***

### jsonb?

> `optional` **jsonb**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:136](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L136)

JSONB usage setting. Must be true (default) for PostgreSQL GROUP BY compatibility.
Setting to false will throw an error as JSON type cannot be used in GROUP BY clauses.

#### Default

```ts
true
```

***

### existsStrict?

> `optional` **existsStrict**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:141](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L141)

Throw when column-anchored EXISTS filters fail to resolve.
Defaults to false so invalid definitions are skipped silently.

***

### schemaInfo?

> `optional` **schemaInfo**: [`SchemaInfo`](../type-aliases/SchemaInfo.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:145](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L145)

Schema metadata used when removing unused LEFT JOINs; overrides builder defaults.

***

### removeUnusedLeftJoins?

> `optional` **removeUnusedLeftJoins**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:149](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L149)

Remove unused LEFT JOINs before further processing when schema info is available.

***

### removeUnusedCtes?

> `optional` **removeUnusedCtes**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:154](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/transformers/DynamicQueryBuilder.ts#L154)

Remove unused Common Table Expressions (CTEs) when they can be safely pruned.
Defaults to false to preserve original WITH definitions.
</div>
