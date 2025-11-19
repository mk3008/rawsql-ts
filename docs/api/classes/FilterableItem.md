<div v-pre>
# Class: FilterableItem

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:22](https://github.com/mk3008/rawsql-ts/blob/4ed5433376f3d2e35a68a48a1db4b0391ec65db1/packages/core/src/transformers/FilterableItemCollector.ts#L22)

Represents a filterable item that can be used in DynamicQueryBuilder
Can be either a table column or a SQL parameter

## Constructors

### Constructor

> **new FilterableItem**(`name`, `type`, `tableName?`): `FilterableItem`

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:23](https://github.com/mk3008/rawsql-ts/blob/4ed5433376f3d2e35a68a48a1db4b0391ec65db1/packages/core/src/transformers/FilterableItemCollector.ts#L23)

#### Parameters

##### name

`string`

##### type

`"column"` | `"parameter"`

##### tableName?

`string`

#### Returns

`FilterableItem`

## Properties

### name

> `readonly` **name**: `string`

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:24](https://github.com/mk3008/rawsql-ts/blob/4ed5433376f3d2e35a68a48a1db4b0391ec65db1/packages/core/src/transformers/FilterableItemCollector.ts#L24)

***

### type

> `readonly` **type**: `"column"` \| `"parameter"`

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:25](https://github.com/mk3008/rawsql-ts/blob/4ed5433376f3d2e35a68a48a1db4b0391ec65db1/packages/core/src/transformers/FilterableItemCollector.ts#L25)

***

### tableName?

> `readonly` `optional` **tableName**: `string`

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:26](https://github.com/mk3008/rawsql-ts/blob/4ed5433376f3d2e35a68a48a1db4b0391ec65db1/packages/core/src/transformers/FilterableItemCollector.ts#L26)
</div>
