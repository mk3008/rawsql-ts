<div v-pre>
# Class: DynamicQueryBuilder

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:193](https://github.com/mk3008/rawsql-ts/blob/4c7c8a4f97538aad171fb5f463a1787c5adb61de/packages/core/src/transformers/DynamicQueryBuilder.ts#L193)

DynamicQueryBuilder combines SQL parsing with dynamic condition injection (filters, sorts, paging, JSON serialization).
It also supports the SSSQL optional-condition path for truthful SQL branches shaped like `(:p IS NULL OR ...)` when you pass `optionalConditionParameters`.
When the filter only targets columns that the current query already exposes, `filter` is the first-choice path. Move to SSSQL only when the optional condition needs a table or SQL branch that the query does not already contain.

Key behaviours verified in packages/core/tests/transformers/DynamicQueryBuilder.test.ts:
- Preserves the input SQL when no options are supplied.
- Applies filter, sort, and pagination in a deterministic order.
- Supports JSON serialization for hierarchical projections.
- Prunes explicitly targeted absent optional branches without widening unsupported SQL shapes.

See also:
- [What Is SSSQL?](../../guide/sssql-overview.md)
- [SSSQL Optional Branch Pruning MVP](../../guide/sssql-optional-branch-pruning.md)
- [Querybuilding Recipes](../../guide/querybuilding-recipes.md)

## Constructors

### Constructor

> **new DynamicQueryBuilder**(`resolverOrOptions?`): `DynamicQueryBuilder`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:203](https://github.com/mk3008/rawsql-ts/blob/4c7c8a4f97538aad171fb5f463a1787c5adb61de/packages/core/src/transformers/DynamicQueryBuilder.ts#L203)

Creates a new DynamicQueryBuilder instance.
Accepts either the legacy table resolver or an options object that can provide schema metadata.

#### Parameters

##### resolverOrOptions?

Optional resolver or configuration object

[`DynamicQueryBuilderOptions`](../interfaces/DynamicQueryBuilderOptions.md) | (`tableName`) => `string`[]

#### Returns

`DynamicQueryBuilder`

## Methods

### buildQuery()

> **buildQuery**(`sqlContent`, `options`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:234](https://github.com/mk3008/rawsql-ts/blob/4c7c8a4f97538aad171fb5f463a1787c5adb61de/packages/core/src/transformers/DynamicQueryBuilder.ts#L234)

Builds a SelectQuery from SQL content with dynamic conditions.
This is a pure function that does not perform any I/O operations.

When the incoming SQL already expresses optional predicates truthfully, prefer `optionalConditionParameters` over string-building `WHERE` fragments outside SQL.

#### Parameters

##### sqlContent

`string`

Raw SQL string to parse and modify

##### options

[`QueryBuildOptions`](../interfaces/QueryBuildOptions.md) = `{}`

Dynamic conditions to apply (filter, sort, paging, serialize, optional-condition pruning)

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

Modified SelectQuery with all dynamic conditions applied

#### Example

```typescript
const builder = new DynamicQueryBuilder();
const query = builder.buildQuery(
  'SELECT id, name FROM users WHERE active = true',
  {
    filter: { status: 'premium' },
    sort: { created_at: { desc: true } },
    paging: { page: 2, pageSize: 10 },
    serialize: { rootName: 'user', rootEntity: { id: 'user', name: 'User', columns: { id: 'id', name: 'name' } }, nestedEntities: [] }
  }
);
```

#### SSSQL Example

```typescript
const sql = `
  SELECT p.product_id, p.product_name
  FROM products p
  WHERE (:brand_name IS NULL OR p.brand_name = :brand_name)
    AND (:category_name IS NULL OR EXISTS (
      SELECT 1
      FROM product_categories pc
      JOIN categories c
        ON c.category_id = pc.category_id
      WHERE pc.product_id = p.product_id
        AND c.category_name = :category_name
    ))
`;

const query = builder.buildQuery(sql, {
  optionalConditionParameters: {
    brand_name: null,
    category_name: 'shoes',
  },
});
```

This keeps the optional-filter intent in SQL source form while pruning only the explicitly targeted absent branch.

***

### buildFilteredQuery()

> **buildFilteredQuery**(`sqlContent`, `filter`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:563](https://github.com/mk3008/rawsql-ts/blob/4c7c8a4f97538aad171fb5f463a1787c5adb61de/packages/core/src/transformers/DynamicQueryBuilder.ts#L563)

Builds a SelectQuery with only filtering applied.
Convenience method for when you only need dynamic WHERE conditions.

#### Parameters

##### sqlContent

`string`

Raw SQL string to parse and modify

##### filter

[`FilterConditions`](../type-aliases/FilterConditions.md)

Filter conditions to apply

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

Modified SelectQuery with filter conditions applied

***

### buildSortedQuery()

> **buildSortedQuery**(`sqlContent`, `sort`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:575](https://github.com/mk3008/rawsql-ts/blob/4c7c8a4f97538aad171fb5f463a1787c5adb61de/packages/core/src/transformers/DynamicQueryBuilder.ts#L575)

Builds a SelectQuery with only sorting applied.
Convenience method for when you only need dynamic ORDER BY clauses.

#### Parameters

##### sqlContent

`string`

Raw SQL string to parse and modify

##### sort

[`SortConditions`](../type-aliases/SortConditions.md)

Sort conditions to apply

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

Modified SelectQuery with sort conditions applied

***

### buildPaginatedQuery()

> **buildPaginatedQuery**(`sqlContent`, `paging`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:585](https://github.com/mk3008/rawsql-ts/blob/4c7c8a4f97538aad171fb5f463a1787c5adb61de/packages/core/src/transformers/DynamicQueryBuilder.ts#L585)

#### Parameters

##### sqlContent

`string`

##### paging

[`PaginationOptions`](../interfaces/PaginationOptions.md)

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

***

### buildSerializedQuery()

> **buildSerializedQuery**(`sqlContent`, `serialize`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:597](https://github.com/mk3008/rawsql-ts/blob/4c7c8a4f97538aad171fb5f463a1787c5adb61de/packages/core/src/transformers/DynamicQueryBuilder.ts#L597)

Builds a SelectQuery with only JSON serialization applied.
Convenience method for when you only need hierarchical JSON transformation.

#### Parameters

##### sqlContent

`string`

Raw SQL string to parse and modify

##### serialize

[`JsonMapping`](../interfaces/JsonMapping.md)

JSON mapping configuration to apply

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

Modified SelectQuery with JSON serialization applied

***

### validateSql()

> **validateSql**(`sqlContent`): `boolean`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:609](https://github.com/mk3008/rawsql-ts/blob/4c7c8a4f97538aad171fb5f463a1787c5adb61de/packages/core/src/transformers/DynamicQueryBuilder.ts#L609)

Validates SQL content by attempting to parse it.
Useful for testing SQL validity without applying any modifications.

#### Parameters

##### sqlContent

`string`

Raw SQL string to validate

#### Returns

`boolean`

true if SQL is valid, throws error if invalid

#### Throws

Error if SQL cannot be parsed
</div>

