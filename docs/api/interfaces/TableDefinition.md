<div v-pre>
# Interface: TableDefinition

Defined in: [packages/core/src/utils/SchemaManager.ts:58](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L58)

Complete table schema definition that users write

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:60](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L60)

Table name in database

***

### displayName?

> `optional` **displayName**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:62](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L62)

Human-readable entity name

***

### columns

> **columns**: `Record`&lt;`string`, [`ColumnDefinition`](ColumnDefinition.md)\&gt;

Defined in: [packages/core/src/utils/SchemaManager.ts:64](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L64)

Column definitions

***

### relationships?

> `optional` **relationships**: [`RelationshipDefinition`](RelationshipDefinition.md)[]

Defined in: [packages/core/src/utils/SchemaManager.ts:66](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/SchemaManager.ts#L66)

Relationships with other tables
</div>
