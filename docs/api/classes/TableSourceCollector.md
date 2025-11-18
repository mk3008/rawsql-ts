<div v-pre>
# Class: TableSourceCollector

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:30](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/TableSourceCollector.ts#L30)

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

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:39](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/TableSourceCollector.ts#L39)

#### Parameters

##### selectableOnly

`boolean` = `true`

#### Returns

`TableSourceCollector`

## Methods

### getTableSources()

> **getTableSources**(): `TableSource`[]

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:103](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/TableSourceCollector.ts#L103)

Gets all collected table sources

#### Returns

`TableSource`[]

***

### collect()

> **collect**(`query`): `TableSource`[]

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:129](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/TableSourceCollector.ts#L129)

#### Parameters

##### query

[`SqlComponent`](SqlComponent.md)

#### Returns

`TableSource`[]

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/TableSourceCollector.ts:139](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/TableSourceCollector.ts#L139)

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
