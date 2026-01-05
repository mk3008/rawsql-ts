<div v-pre>
# Class: FilterableItemCollector

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:46](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/transformers/FilterableItemCollector.ts#L46)

Collects filterable items (columns and parameters) from SQL queries
for use in DynamicQueryBuilder filtering functionality.

This class combines:
- Table columns (from SelectableColumnCollector with FullName duplicate detection)
- SQL parameters (from ParameterDetector)

Features:
- FullName mode preserves columns with same names from different tables (u.id vs p.id)
- Upstream collection (default) provides comprehensive column discovery for maximum filtering
- Qualified mode option for table.column naming in complex JOINs

This allows DynamicQueryBuilder to filter on both actual table columns
and fixed parameters defined in the SQL with full JOIN table support.

## Constructors

### Constructor

> **new FilterableItemCollector**(`tableColumnResolver?`, `options?`): `FilterableItemCollector`

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:57](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/transformers/FilterableItemCollector.ts#L57)

Creates a new FilterableItemCollector

#### Parameters

##### tableColumnResolver?

[`TableColumnResolver`](../type-aliases/TableColumnResolver.md)

Optional resolver for wildcard column expansion

##### options?

[`FilterableItemCollectorOptions`](../interfaces/FilterableItemCollectorOptions.md)

Optional configuration options
  - qualified: If true, return table.column names; if false, return column names only
  - upstream: If true (default), collect all available columns from upstream sources for maximum filtering capability

#### Returns

`FilterableItemCollector`

## Methods

### collect()

> **collect**(`query`): [`FilterableItem`](FilterableItem.md)[]

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:67](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/transformers/FilterableItemCollector.ts#L67)

Collects all filterable items (columns and parameters) from a SQL query

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The parsed SQL query to analyze

#### Returns

[`FilterableItem`](FilterableItem.md)[]

Array of FilterableItem objects representing columns and parameters
</div>
