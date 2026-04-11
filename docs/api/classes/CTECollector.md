<div v-pre>
# Class: CTECollector

Defined in: [packages/core/src/transformers/CTECollector.ts:29](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/CTECollector.ts#L29)

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

Defined in: [packages/core/src/transformers/CTECollector.ts:35](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/CTECollector.ts#L35)

#### Returns

`CTECollector`

## Methods

### getCommonTables()

> **getCommonTables**(): [`CommonTable`](CommonTable.md)[]

Defined in: [packages/core/src/transformers/CTECollector.ts:118](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/CTECollector.ts#L118)

Get all collected CommonTables

#### Returns

[`CommonTable`](CommonTable.md)[]

***

### collect()

> **collect**(`query`): [`CommonTable`](CommonTable.md)[]

Defined in: [packages/core/src/transformers/CTECollector.ts:130](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/CTECollector.ts#L130)

#### Parameters

##### query

[`SqlComponent`](SqlComponent.md)

#### Returns

[`CommonTable`](CommonTable.md)[]

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/CTECollector.ts:140](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/CTECollector.ts#L140)

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

Defined in: [packages/core/src/transformers/CTECollector.ts:583](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/CTECollector.ts#L583)

#### Parameters

##### partitionBy

[`PartitionByClause`](PartitionByClause.md)

#### Returns

`void`

***

### visitValueList()

> **visitValueList**(`valueList`): `void`

Defined in: [packages/core/src/transformers/CTECollector.ts:587](https://github.com/mk3008/rawsql-ts/blob/4084a3e1c34cb553d019775fbab6a321705980e8/packages/core/src/transformers/CTECollector.ts#L587)

#### Parameters

##### valueList

[`ValueList`](ValueList.md)

#### Returns

`void`
</div>
