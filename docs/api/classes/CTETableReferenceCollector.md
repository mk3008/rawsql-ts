<div v-pre>
# Class: CTETableReferenceCollector

Defined in: [packages/core/src/transformers/CTETableReferenceCollector.ts:26](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/CTETableReferenceCollector.ts#L26)

A specialized table source collector designed for CTE dependency analysis.

Unlike the general-purpose TableSourceCollector, this collector:
- Always includes CTE references in results (treats CTEs as valid table sources)
- Always performs deep traversal of subqueries, WHERE clauses, etc.
- Is optimized for dependency analysis rather than database schema analysis

This collector is specifically designed for use by CTEDependencyAnalyzer to track
which tables/CTEs are referenced by queries at any nesting level.

## Implements

- [`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`void`\&gt;

## Constructors

### Constructor

> **new CTETableReferenceCollector**(): `CTETableReferenceCollector`

Defined in: [packages/core/src/transformers/CTETableReferenceCollector.ts:33](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/CTETableReferenceCollector.ts#L33)

#### Returns

`CTETableReferenceCollector`

## Methods

### collect()

> **collect**(`query`): `TableSource`[]

Defined in: [packages/core/src/transformers/CTETableReferenceCollector.ts:94](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/CTETableReferenceCollector.ts#L94)

Collects all table references from the given SQL component

#### Parameters

##### query

[`SqlComponent`](SqlComponent.md)

The SQL component to analyze

#### Returns

`TableSource`[]

Array of TableSource objects representing all table references

***

### getTableSources()

> **getTableSources**(): `TableSource`[]

Defined in: [packages/core/src/transformers/CTETableReferenceCollector.ts:102](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/CTETableReferenceCollector.ts#L102)

Gets all collected table sources

#### Returns

`TableSource`[]

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/CTETableReferenceCollector.ts:130](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/CTETableReferenceCollector.ts#L130)

Main entry point for the visitor pattern.

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

#### Returns

`void`

#### Implementation of

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md).[`visit`](../interfaces/SqlComponentVisitor.md#visit)
</div>
