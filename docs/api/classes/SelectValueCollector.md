<div v-pre>
# Class: SelectValueCollector

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:13](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/SelectValueCollector.ts#L13)

A visitor that collects all SelectItem instances from a SQL query structure.
This visitor scans through select clauses and collects all the SelectItem objects.
It can also resolve wildcard selectors (table.* or *) using a provided table column resolver.

## Implements

- [`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`void`\&gt;

## Constructors

### Constructor

> **new SelectValueCollector**(`tableColumnResolver`, `initialCommonTables`): `SelectValueCollector`

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:23](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/SelectValueCollector.ts#L23)

#### Parameters

##### tableColumnResolver

`null` | [`TableColumnResolver`](../type-aliases/TableColumnResolver.md)

##### initialCommonTables

`null` | `CommonTable`[]

#### Returns

`SelectValueCollector`

## Properties

### initialCommonTables

> **initialCommonTables**: `null` \| `CommonTable`[]

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:21](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/SelectValueCollector.ts#L21)

## Methods

### getValues()

> **getValues**(): `object`[]

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:41](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/SelectValueCollector.ts#L41)

Get all collected SelectItems as an array of objects with name and value properties

#### Returns

`object`[]

An array of objects with name (string) and value (ValueComponent) properties

***

### collect()

> **collect**(`arg`): `object`[]

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:58](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/SelectValueCollector.ts#L58)

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

#### Returns

`object`[]

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/SelectValueCollector.ts:70](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/SelectValueCollector.ts#L70)

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
