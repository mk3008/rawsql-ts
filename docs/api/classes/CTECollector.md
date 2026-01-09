<div v-pre>
# Class: CTECollector

Defined in: [packages/core/src/transformers/CTECollector.ts:28](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/CTECollector.ts#L28)

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

Defined in: [packages/core/src/transformers/CTECollector.ts:34](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/CTECollector.ts#L34)

#### Returns

`CTECollector`

## Methods

### getCommonTables()

> **getCommonTables**(): [`CommonTable`](CommonTable.md)[]

Defined in: [packages/core/src/transformers/CTECollector.ts:116](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/CTECollector.ts#L116)

Get all collected CommonTables

#### Returns

[`CommonTable`](CommonTable.md)[]

***

### collect()

> **collect**(`query`): [`CommonTable`](CommonTable.md)[]

Defined in: [packages/core/src/transformers/CTECollector.ts:128](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/CTECollector.ts#L128)

#### Parameters

##### query

[`SqlComponent`](SqlComponent.md)

#### Returns

[`CommonTable`](CommonTable.md)[]

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/CTECollector.ts:138](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/CTECollector.ts#L138)

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

Defined in: [packages/core/src/transformers/CTECollector.ts:545](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/CTECollector.ts#L545)

#### Parameters

##### partitionBy

[`PartitionByClause`](PartitionByClause.md)

#### Returns

`void`

***

### visitValueList()

> **visitValueList**(`valueList`): `void`

Defined in: [packages/core/src/transformers/CTECollector.ts:549](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/CTECollector.ts#L549)

#### Parameters

##### valueList

[`ValueList`](ValueList.md)

#### Returns

`void`
</div>
