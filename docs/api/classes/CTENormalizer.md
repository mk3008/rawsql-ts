<div v-pre>
# Class: CTENormalizer

Defined in: [packages/core/src/transformers/CTENormalizer.ts:20](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/transformers/CTENormalizer.ts#L20)

CTENormalizer is responsible for normalizing Common Table Expressions (CTEs) within SQL queries.
It collects all CTEs from various parts of the query and consolidates them into a single WITH clause
at the root level of the query.

This implementation uses:
1. CommonTableCollector - to gather all CTEs from the query structure
2. WithClauseDisabler - to remove all original WITH clauses from the query
3. CTENameConflictResolver - to resolve name conflicts among CTEs and sort them properly

## Methods

### normalize()

> `static` **normalize**(`query`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/CTENormalizer.ts:34](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/transformers/CTENormalizer.ts#L34)

Normalizes a SQL query by consolidating all CTEs into a single WITH clause
at the root level of the query.

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The query to normalize

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

A new normalized query with all CTEs at the root level
</div>
