<div v-pre>
# Class: FilterableItem

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:22](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/FilterableItemCollector.ts#L22)

Represents a filterable item that can be used in DynamicQueryBuilder
Can be either a table column or a SQL parameter

## Constructors

### Constructor

> **new FilterableItem**(`name`, `type`, `tableName?`): `FilterableItem`

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:23](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/FilterableItemCollector.ts#L23)

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

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:24](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/FilterableItemCollector.ts#L24)

***

### type

> `readonly` **type**: `"column"` \| `"parameter"`

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:25](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/FilterableItemCollector.ts#L25)

***

### tableName?

> `readonly` `optional` **tableName**: `string`

Defined in: [packages/core/src/transformers/FilterableItemCollector.ts:26](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/FilterableItemCollector.ts#L26)
</div>
