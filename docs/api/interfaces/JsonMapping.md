<div v-pre>
# Interface: JsonMapping

Defined in: [packages/core/src/transformers/PostgresJsonQueryBuilder.ts:15](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/PostgresJsonQueryBuilder.ts#L15)

Universal JSON mapping definition for creating any level of JSON structures.
Supports flat arrays, nested objects, and unlimited hierarchical structures.

## Properties

### rootName

> **rootName**: `string`

Defined in: [packages/core/src/transformers/PostgresJsonQueryBuilder.ts:16](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/PostgresJsonQueryBuilder.ts#L16)

***

### rootEntity

> **rootEntity**: `object`

Defined in: [packages/core/src/transformers/PostgresJsonQueryBuilder.ts:17](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/PostgresJsonQueryBuilder.ts#L17)

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

Defined in: [packages/core/src/transformers/PostgresJsonQueryBuilder.ts:22](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/PostgresJsonQueryBuilder.ts#L22)

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

Defined in: [packages/core/src/transformers/PostgresJsonQueryBuilder.ts:30](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/PostgresJsonQueryBuilder.ts#L30)

***

### emptyResult?

> `optional` **emptyResult**: `string`

Defined in: [packages/core/src/transformers/PostgresJsonQueryBuilder.ts:31](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/PostgresJsonQueryBuilder.ts#L31)
</div>
