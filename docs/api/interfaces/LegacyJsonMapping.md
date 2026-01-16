<div v-pre>
# Interface: LegacyJsonMapping

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:101](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/transformers/EnhancedJsonMapping.ts#L101)

Legacy JSON mapping interface (from PostgresJsonQueryBuilder).

## Properties

### rootName

> **rootName**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:102](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/transformers/EnhancedJsonMapping.ts#L102)

***

### rootEntity

> **rootEntity**: `object`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:103](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/transformers/EnhancedJsonMapping.ts#L103)

#### id

> **id**: `string`

#### name

> **name**: `string`

#### columns

> **columns**: `object`

##### Index Signature

\[`jsonKey`: `string`\]: `string`

***

### nestedEntities

> **nestedEntities**: `object`[]

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:108](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/transformers/EnhancedJsonMapping.ts#L108)

#### id

> **id**: `string`

#### name

> **name**: `string`

#### parentId

> **parentId**: `string`

#### propertyName

> **propertyName**: `string`

#### relationshipType?

> `optional` **relationshipType**: `"object"` \| `"array"`

#### columns

> **columns**: `object`

##### Index Signature

\[`jsonKey`: `string`\]: `string`

***

### resultFormat?

> `optional` **resultFormat**: `"array"` \| `"single"`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:116](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/transformers/EnhancedJsonMapping.ts#L116)

***

### emptyResult?

> `optional` **emptyResult**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:117](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/transformers/EnhancedJsonMapping.ts#L117)
</div>
