<div v-pre>
# Class: TableSourceCollector

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:37](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/TableSourceCollector.ts#L37)

A visitor that collects all table source names from a SQL query structure.

When selectableOnly is true (default behavior):
- Includes only table sources from FROM and JOIN clauses
- Excludes inline queries, subqueries, and CTEs

When selectableOnly is false:
- Scans all parts of the query including WITH clauses, subqueries, etc.      
- Collects all table sources from the entire query
- Excludes tables that are managed by CTEs

When dedupe is true (default behavior), repeated table sources are collapsed
by their qualified name; pass dedupe=false to retain duplicates.

For UNION-like queries, it scans both the left and right parts.

## Implements

- [`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`void`\&gt;

## Constructors

### Constructor

> **new TableSourceCollector**(`selectableOnly`, `dedupe`): `TableSourceCollector`

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:47](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/TableSourceCollector.ts#L47)

#### Parameters

##### selectableOnly

`boolean` = `true`

##### dedupe

`boolean` = `true`

#### Returns

`TableSourceCollector`

## Methods

### getTableSources()

> **getTableSources**(): [`TableSource`](TableSource.md)[]

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:118](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/TableSourceCollector.ts#L118)

Gets all collected table sources

#### Returns

[`TableSource`](TableSource.md)[]

***

### collect()

> **collect**(`query`): [`TableSource`](TableSource.md)[]

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:144](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/TableSourceCollector.ts#L144)

#### Parameters

##### query

[`SqlComponent`](SqlComponent.md)

#### Returns

[`TableSource`](TableSource.md)[]

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:154](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/TableSourceCollector.ts#L154)

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
