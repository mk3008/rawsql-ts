<div v-pre>
# Interface: TableDefinition

Defined in: [packages/core/src/utils/SchemaManager.ts:63](https://github.com/mk3008/rawsql-ts/blob/e7e8feb36e790d0bdcd09fe2915fd3f87fd0aef4/packages/core/src/utils/SchemaManager.ts#L63)

Complete table schema definition that users write

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:65](https://github.com/mk3008/rawsql-ts/blob/e7e8feb36e790d0bdcd09fe2915fd3f87fd0aef4/packages/core/src/utils/SchemaManager.ts#L65)

Table name in database

***

### displayName?

> `optional` **displayName**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:67](https://github.com/mk3008/rawsql-ts/blob/e7e8feb36e790d0bdcd09fe2915fd3f87fd0aef4/packages/core/src/utils/SchemaManager.ts#L67)

Human-readable entity name

***

### columns

> **columns**: `Record`&lt;`string`, [`ColumnDefinition`](ColumnDefinition.md)\&gt;

Defined in: [packages/core/src/utils/SchemaManager.ts:69](https://github.com/mk3008/rawsql-ts/blob/e7e8feb36e790d0bdcd09fe2915fd3f87fd0aef4/packages/core/src/utils/SchemaManager.ts#L69)

Column definitions

***

### relationships?

> `optional` **relationships**: [`RelationshipDefinition`](RelationshipDefinition.md)[]

Defined in: [packages/core/src/utils/SchemaManager.ts:71](https://github.com/mk3008/rawsql-ts/blob/e7e8feb36e790d0bdcd09fe2915fd3f87fd0aef4/packages/core/src/utils/SchemaManager.ts#L71)

Relationships with other tables
</div>
