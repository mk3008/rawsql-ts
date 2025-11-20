<div v-pre>
# Class: SelectableColumnCollector

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:76](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/transformers/SelectableColumnCollector.ts#L76)

A visitor that collects all ColumnReference instances from SQL query structures.
This visitor scans through all clauses and collects all unique ColumnReference objects.
It supports both regular column collection and upstream column collection for maximum
search conditions in DynamicQuery scenarios.

Supported query types:
- SimpleSelectQuery: Basic SELECT queries with all standard clauses
- BinarySelectQuery: UNION, INTERSECT, EXCEPT queries (collects from both sides)
- Common Table Expressions (CTEs) within queries
- Subqueries and nested queries

Behavioral notes:
- Collects column references to tables defined in the root FROM/JOIN clauses
- For aliased columns (e.g., 'title as name'), collects both the original column 
  reference ('title') AND the alias ('name') to enable complete dependency tracking
- When upstream option is enabled, collects all available columns from upstream sources
  (CTEs, subqueries, and tables) for maximum search conditions in DynamicQuery
- Automatically removes duplicates based on the specified duplicate detection mode

Use cases:
- Dependency analysis and schema migration tools
- Column usage tracking across complex queries including unions and CTEs
- Security analysis for column-level access control
- DynamicQuery maximum search condition column discovery

## Example

```typescript
// Basic usage - collect only referenced columns
const collector = new SelectableColumnCollector();
const columns = collector.collect(query);

// With upstream collection for DynamicQuery
const upstreamCollector = new SelectableColumnCollector(
  null, false, DuplicateDetectionMode.ColumnNameOnly, 
  { upstream: true }
);
const allColumns = upstreamCollector.collect(query);

// Works with union queries and CTEs
const unionQuery = SelectQueryParser.parse(`
  SELECT name, email FROM users 
  UNION 
  SELECT name, email FROM customers
`);
const unionColumns = collector.collect(unionQuery);
```
Related tests: packages/core/tests/transformers/SelectableColumnCollector.test.ts

## Implements

- [`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`void`\&gt;

## Constructors

### Constructor

> **new SelectableColumnCollector**(`tableColumnResolver?`, `includeWildCard?`, `duplicateDetection?`, `options?`): `SelectableColumnCollector`

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:99](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/transformers/SelectableColumnCollector.ts#L99)

Creates a new instance of SelectableColumnCollector.

#### Parameters

##### tableColumnResolver?

The resolver used to resolve column references to their respective tables.

`null` | [`TableColumnResolver`](../type-aliases/TableColumnResolver.md)

##### includeWildCard?

`boolean` = `false`

If true, wildcard columns (e.g., `*`) are included in the collection.

##### duplicateDetection?

[`DuplicateDetectionMode`](../enumerations/DuplicateDetectionMode.md) = `DuplicateDetectionMode.ColumnNameOnly`

Specifies the duplicate detection mode: 'columnNameOnly' (default, only column name is used), or 'fullName' (table name + column name).

##### options?

Additional options for the collector.

###### ignoreCaseAndUnderscore?

`boolean`

If true, column names are compared without considering case and underscores.

###### upstream?

`boolean`

If true, collect all columns available from upstream sources for maximum search conditions in DynamicQuery.

#### Returns

`SelectableColumnCollector`

## Methods

### getValues()

> **getValues**(): `object`[]

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:185](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/transformers/SelectableColumnCollector.ts#L185)

#### Returns

`object`[]

***

### collect()

> **collect**(`arg`): `object`[]

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:189](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/transformers/SelectableColumnCollector.ts#L189)

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

#### Returns

`object`[]

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:262](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/transformers/SelectableColumnCollector.ts#L262)

Main entry point for the visitor pattern.
Implements the shallow visit pattern to distinguish between root and recursive visits.

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

#### Returns

`void`

#### Implementation of

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md).[`visit`](../interfaces/SqlComponentVisitor.md#visit)
</div>
