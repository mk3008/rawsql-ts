<div v-pre>
# Interface: RelationshipDefinition

Defined in: [packages/core/src/utils/SchemaManager.ts:44](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L44)

Table relationship definition

## Properties

### type

> **type**: `"object"` \| `"array"`

Defined in: [packages/core/src/utils/SchemaManager.ts:46](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L46)

Type of relationship

***

### table

> **table**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:48](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L48)

Target table name

***

### propertyName

> **propertyName**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:50](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L50)

Caller-owned relationship property name

***

### targetKey?

> `optional` **targetKey**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:52](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L52)

Optional: Override target table's primary key
</div>
