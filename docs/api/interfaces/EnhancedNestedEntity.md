<div v-pre>
# Interface: EnhancedNestedEntity

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:44](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L44)

Enhanced nested entity with relationship metadata.

## Extends

- [`EnhancedEntity`](EnhancedEntity.md)

## Properties

### id

> **id**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:34](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L34)

#### Inherited from

[`EnhancedEntity`](EnhancedEntity.md).[`id`](EnhancedEntity.md#id)

***

### name

> **name**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:35](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L35)

#### Inherited from

[`EnhancedEntity`](EnhancedEntity.md).[`name`](EnhancedEntity.md#name)

***

### columns

> **columns**: `Record`&lt;`string`, [`ColumnMapping`](../type-aliases/ColumnMapping.md)\&gt;

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:36](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L36)

#### Inherited from

[`EnhancedEntity`](EnhancedEntity.md).[`columns`](EnhancedEntity.md#columns)

***

### description?

> `optional` **description**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:38](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L38)

Entity description for documentation

#### Inherited from

[`EnhancedEntity`](EnhancedEntity.md).[`description`](EnhancedEntity.md#description)

***

### parentId

> **parentId**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:45](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L45)

***

### propertyName

> **propertyName**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:46](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L46)

***

### relationshipType

> **relationshipType**: `"object"` \| `"array"`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:47](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L47)

***

### joinCondition?

> `optional` **joinCondition**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:49](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L49)

Join condition for complex relationships
</div>
