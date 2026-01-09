<div v-pre>
# Class: DynamicQueryBuilder

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:137](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/DynamicQueryBuilder.ts#L137)

DynamicQueryBuilder combines SQL parsing with dynamic condition injection (filters, sorts, paging, JSON serialization).

Key behaviours verified in packages/core/tests/transformers/DynamicQueryBuilder.test.ts:
- Preserves the input SQL when no options are supplied.
- Applies filter, sort, and pagination in a deterministic order.
- Supports JSON serialization for hierarchical projections.

## Constructors

### Constructor

> **new DynamicQueryBuilder**(`tableColumnResolver?`): `DynamicQueryBuilder`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:143](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/DynamicQueryBuilder.ts#L143)

Creates a new DynamicQueryBuilder instance

#### Parameters

##### tableColumnResolver?

(`tableName`) => `string`[]

Optional function to resolve table columns for wildcard queries

#### Returns

`DynamicQueryBuilder`

## Methods

### buildQuery()

> **buildQuery**(`sqlContent`, `options`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:167](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/DynamicQueryBuilder.ts#L167)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:350](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/DynamicQueryBuilder.ts#L350)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:362](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/DynamicQueryBuilder.ts#L362)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:372](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/DynamicQueryBuilder.ts#L372)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:384](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/DynamicQueryBuilder.ts#L384)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:396](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/DynamicQueryBuilder.ts#L396)

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
