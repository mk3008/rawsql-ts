<div v-pre>
# Class: TableSourceCollector

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:36](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/TableSourceCollector.ts#L36)

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

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:46](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/TableSourceCollector.ts#L46)

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

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:116](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/TableSourceCollector.ts#L116)

Gets all collected table sources

#### Returns

[`TableSource`](TableSource.md)[]

***

### collect()

> **collect**(`query`): [`TableSource`](TableSource.md)[]

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:142](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/TableSourceCollector.ts#L142)

#### Parameters

##### query

[`SqlComponent`](SqlComponent.md)

#### Returns

[`TableSource`](TableSource.md)[]

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:152](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/TableSourceCollector.ts#L152)

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
