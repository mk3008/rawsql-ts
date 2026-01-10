<div v-pre>
# Interface: QueryBuildOptions

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:107](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L107)

Options for dynamic query building

## Properties

### filter?

> `optional` **filter**: [`FilterConditions`](../type-aliases/FilterConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:109](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L109)

Filter conditions to inject into WHERE clause

***

### sort?

> `optional` **sort**: [`SortConditions`](../type-aliases/SortConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:111](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L111)

Sort conditions to inject into ORDER BY clause

***

### paging?

> `optional` **paging**: [`PaginationOptions`](PaginationOptions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:113](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L113)

Pagination options to inject LIMIT/OFFSET clauses

***

### serialize?

> `optional` **serialize**: `boolean` \| [`JsonMapping`](JsonMapping.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:119](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L119)

JSON serialization mapping to transform results into hierarchical JSON
- JsonMapping object: explicit mapping configuration
- true: auto-load mapping from corresponding .json file
- false/undefined: no serialization

***

### jsonb?

> `optional` **jsonb**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:125](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L125)

JSONB usage setting. Must be true (default) for PostgreSQL GROUP BY compatibility.
Setting to false will throw an error as JSON type cannot be used in GROUP BY clauses.

#### Default

```ts
true
```

***

### existsStrict?

> `optional` **existsStrict**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:130](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L130)

Throw when column-anchored EXISTS filters fail to resolve.
Defaults to false so invalid definitions are skipped silently.

***

### schemaInfo?

> `optional` **schemaInfo**: [`SchemaInfo`](../type-aliases/SchemaInfo.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:134](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L134)

Schema metadata used when removing unused LEFT JOINs; overrides builder defaults.

***

### removeUnusedLeftJoins?

> `optional` **removeUnusedLeftJoins**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:138](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L138)

Remove unused LEFT JOINs before further processing when schema info is available.

***

### removeUnusedCtes?

> `optional` **removeUnusedCtes**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:143](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L143)

Remove unused Common Table Expressions (CTEs) when they can be safely pruned.
Defaults to false to preserve original WITH definitions.
</div>
