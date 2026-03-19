<div v-pre>
# Interface: TableDefinition

Defined in: [packages/core/src/utils/SchemaManager.ts:63](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/utils/SchemaManager.ts#L63)

Complete table schema definition that users write

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:65](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/utils/SchemaManager.ts#L65)

Table name in database

***

### displayName?

> `optional` **displayName**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:67](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/utils/SchemaManager.ts#L67)

Human-readable entity name

***

### columns

> **columns**: `Record`&lt;`string`, [`ColumnDefinition`](ColumnDefinition.md)\&gt;

Defined in: [packages/core/src/utils/SchemaManager.ts:69](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/utils/SchemaManager.ts#L69)

Column definitions

***

### relationships?

> `optional` **relationships**: [`RelationshipDefinition`](RelationshipDefinition.md)[]

Defined in: [packages/core/src/utils/SchemaManager.ts:71](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/utils/SchemaManager.ts#L71)

Relationships with other tables
</div>
