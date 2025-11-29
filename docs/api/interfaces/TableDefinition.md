<div v-pre>
# Interface: TableDefinition

Defined in: [packages/core/src/utils/SchemaManager.ts:63](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/utils/SchemaManager.ts#L63)

Complete table schema definition that users write

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:65](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/utils/SchemaManager.ts#L65)

Table name in database

***

### displayName?

> `optional` **displayName**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:67](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/utils/SchemaManager.ts#L67)

Human-readable entity name

***

### columns

> **columns**: `Record`&lt;`string`, [`ColumnDefinition`](ColumnDefinition.md)\&gt;

Defined in: [packages/core/src/utils/SchemaManager.ts:69](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/utils/SchemaManager.ts#L69)

Column definitions

***

### relationships?

> `optional` **relationships**: [`RelationshipDefinition`](RelationshipDefinition.md)[]

Defined in: [packages/core/src/utils/SchemaManager.ts:71](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/utils/SchemaManager.ts#L71)

Relationships with other tables
</div>
