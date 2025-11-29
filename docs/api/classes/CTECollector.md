<div v-pre>
# Class: CTECollector

Defined in: [packages/core/src/transformers/CTECollector.ts:25](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/CTECollector.ts#L25)

A visitor that collects all CommonTable instances from a SQL query structure.
This includes tables from:
- WITH clauses
- Subqueries
- Inline queries
- UNION queries
- Value components that may contain queries

## Implements

- [`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`void`\&gt;

## Constructors

### Constructor

> **new CTECollector**(): `CTECollector`

Defined in: [packages/core/src/transformers/CTECollector.ts:31](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/CTECollector.ts#L31)

#### Returns

`CTECollector`

## Methods

### getCommonTables()

> **getCommonTables**(): [`CommonTable`](CommonTable.md)[]

Defined in: [packages/core/src/transformers/CTECollector.ts:108](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/CTECollector.ts#L108)

Get all collected CommonTables

#### Returns

[`CommonTable`](CommonTable.md)[]

***

### collect()

> **collect**(`query`): [`CommonTable`](CommonTable.md)[]

Defined in: [packages/core/src/transformers/CTECollector.ts:120](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/CTECollector.ts#L120)

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

#### Returns

[`CommonTable`](CommonTable.md)[]

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/CTECollector.ts:130](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/CTECollector.ts#L130)

Main entry point for the visitor pattern.
Implements the shallow visit pattern to distinguish between root and recursive visits.

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

#### Returns

`void`

#### Implementation of

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md).[`visit`](../interfaces/SqlComponentVisitor.md#visit)

***

### visitPartitionByClause()

> **visitPartitionByClause**(`partitionBy`): `void`

Defined in: [packages/core/src/transformers/CTECollector.ts:487](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/CTECollector.ts#L487)

#### Parameters

##### partitionBy

[`PartitionByClause`](PartitionByClause.md)

#### Returns

`void`

***

### visitValueList()

> **visitValueList**(`valueList`): `void`

Defined in: [packages/core/src/transformers/CTECollector.ts:491](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/CTECollector.ts#L491)

#### Parameters

##### valueList

[`ValueList`](ValueList.md)

#### Returns

`void`
</div>
