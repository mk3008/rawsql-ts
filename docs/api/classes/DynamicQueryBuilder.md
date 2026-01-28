<div v-pre>
# Class: DynamicQueryBuilder

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:178](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/DynamicQueryBuilder.ts#L178)

DynamicQueryBuilder combines SQL parsing with dynamic condition injection (filters, sorts, paging, JSON serialization).

Key behaviours verified in packages/core/tests/transformers/DynamicQueryBuilder.test.ts:
- Preserves the input SQL when no options are supplied.
- Applies filter, sort, and pagination in a deterministic order.
- Supports JSON serialization for hierarchical projections.

## Constructors

### Constructor

> **new DynamicQueryBuilder**(`resolverOrOptions?`): `DynamicQueryBuilder`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:188](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/DynamicQueryBuilder.ts#L188)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:219](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/DynamicQueryBuilder.ts#L219)

Builds a SelectQuery from SQL content with dynamic conditions.
This is a pure function that does not perform any I/O operations.

#### Parameters

##### sqlContent

`string`

Raw SQL string to parse and modify

##### options

[`QueryBuildOptions`](../interfaces/QueryBuildOptions.md) = `{}`

Dynamic conditions to apply (filter, sort, paging, serialize)

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

***

### buildFilteredQuery()

> **buildFilteredQuery**(`sqlContent`, `filter`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:523](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/DynamicQueryBuilder.ts#L523)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:535](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/DynamicQueryBuilder.ts#L535)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:545](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/DynamicQueryBuilder.ts#L545)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:557](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/DynamicQueryBuilder.ts#L557)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:569](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/DynamicQueryBuilder.ts#L569)

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
