<div v-pre>
# Interface: QueryBuildOptions

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:81](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/transformers/DynamicQueryBuilder.ts#L81)

Options for dynamic query building

## Properties

### filter?

> `optional` **filter**: [`FilterConditions`](../type-aliases/FilterConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:83](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/transformers/DynamicQueryBuilder.ts#L83)

Filter conditions to inject into WHERE clause

***

### sort?

> `optional` **sort**: [`SortConditions`](../type-aliases/SortConditions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:85](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/transformers/DynamicQueryBuilder.ts#L85)

Sort conditions to inject into ORDER BY clause

***

### paging?

> `optional` **paging**: [`PaginationOptions`](PaginationOptions.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:87](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/transformers/DynamicQueryBuilder.ts#L87)

Pagination options to inject LIMIT/OFFSET clauses

***

### serialize?

> `optional` **serialize**: `boolean` \| [`JsonMapping`](JsonMapping.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:93](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/transformers/DynamicQueryBuilder.ts#L93)

JSON serialization mapping to transform results into hierarchical JSON
- JsonMapping object: explicit mapping configuration
- true: auto-load mapping from corresponding .json file
- false/undefined: no serialization

***

### jsonb?

> `optional` **jsonb**: `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:99](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/transformers/DynamicQueryBuilder.ts#L99)

JSONB usage setting. Must be true (default) for PostgreSQL GROUP BY compatibility.
Setting to false will throw an error as JSON type cannot be used in GROUP BY clauses.

#### Default

```ts
true
```
</div>
