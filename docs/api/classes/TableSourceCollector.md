<div v-pre>
# Class: TableSourceCollector

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:33](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/TableSourceCollector.ts#L33)

A visitor that collects all table source names from a SQL query structure.

When selectableOnly is true (default behavior):
- Includes only table sources from FROM and JOIN clauses
- Excludes inline queries, subqueries, and CTEs

When selectableOnly is false:
- Scans all parts of the query including WITH clauses, subqueries, etc.
- Collects all table sources from the entire query
- Excludes tables that are managed by CTEs

For UNION-like queries, it scans both the left and right parts.

## Implements

- [`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`void`\&gt;

## Constructors

### Constructor

> **new TableSourceCollector**(`selectableOnly`): `TableSourceCollector`

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:42](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/TableSourceCollector.ts#L42)

#### Parameters

##### selectableOnly

`boolean` = `true`

#### Returns

`TableSourceCollector`

## Methods

### getTableSources()

> **getTableSources**(): [`TableSource`](TableSource.md)[]

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:111](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/TableSourceCollector.ts#L111)

Gets all collected table sources

#### Returns

[`TableSource`](TableSource.md)[]

***

### collect()

> **collect**(`query`): [`TableSource`](TableSource.md)[]

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:137](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/TableSourceCollector.ts#L137)

#### Parameters

##### query

[`SqlComponent`](SqlComponent.md)

#### Returns

[`TableSource`](TableSource.md)[]

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:147](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/TableSourceCollector.ts#L147)

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
