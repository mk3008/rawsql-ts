<div v-pre>
# Interface: EnhancedJsonMapping

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:69](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L69)

Enhanced JSON mapping with type safety and metadata support.

## Properties

### rootName

> **rootName**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:71](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L71)

Root entity name

***

### rootEntity

> **rootEntity**: [`EnhancedEntity`](EnhancedEntity.md)

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:73](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L73)

Root entity definition

***

### nestedEntities

> **nestedEntities**: [`EnhancedNestedEntity`](EnhancedNestedEntity.md)[]

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:75](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L75)

Nested entities

***

### resultFormat?

> `optional` **resultFormat**: `"array"` \| `"single"`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:77](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L77)

Result format

***

### emptyResult?

> `optional` **emptyResult**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:79](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L79)

Empty result fallback

***

### typeInfo?

> `optional` **typeInfo**: `object`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:81](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L81)

Type information

#### interface

> **interface**: `string`

#### importPath

> **importPath**: `string`

#### generics?

> `optional` **generics**: `string`[]

***

### typeProtection?

> `optional` **typeProtection**: [`TypeProtectionConfig`](TypeProtectionConfig.md)

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:87](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L87)

Type protection configuration

***

### metadata?

> `optional` **metadata**: `object`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:89](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/transformers/EnhancedJsonMapping.ts#L89)

Mapping metadata

#### version

> **version**: `string`

#### description?

> `optional` **description**: `string`

#### author?

> `optional` **author**: `string`

#### createdAt?

> `optional` **createdAt**: `string`

#### updatedAt?

> `optional` **updatedAt**: `string`
</div>
