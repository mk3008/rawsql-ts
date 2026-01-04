<div v-pre>
# Class: SelectValueCollector

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:16](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/SelectValueCollector.ts#L16)

A visitor that collects all SelectItem instances from a SQL query structure.
This visitor scans through select clauses and collects all the SelectItem objects.
It can also resolve wildcard selectors (table.* or *) using a provided table column resolver.

## Implements

- [`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`void`\&gt;

## Constructors

### Constructor

> **new SelectValueCollector**(`tableColumnResolver`, `initialCommonTables`): `SelectValueCollector`

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:26](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/SelectValueCollector.ts#L26)

#### Parameters

##### tableColumnResolver

`null` | [`TableColumnResolver`](../type-aliases/TableColumnResolver.md)

##### initialCommonTables

`null` | [`CommonTable`](CommonTable.md)[]

#### Returns

`SelectValueCollector`

## Properties

### initialCommonTables

> **initialCommonTables**: `null` \| [`CommonTable`](CommonTable.md)[]

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:24](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/SelectValueCollector.ts#L24)

## Methods

### getValues()

> **getValues**(): `object`[]

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:44](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/SelectValueCollector.ts#L44)

Get all collected SelectItems as an array of objects with name and value properties

#### Returns

`object`[]

An array of objects with name (string) and value (ValueComponent) properties

***

### collect()

> **collect**(`arg`): `object`[]

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:61](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/SelectValueCollector.ts#L61)

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

#### Returns

`object`[]

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:73](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/SelectValueCollector.ts#L73)

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
