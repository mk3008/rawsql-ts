<div v-pre>
# Interface: RelationshipDefinition

Defined in: [packages/core/src/utils/SchemaManager.ts:49](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/utils/SchemaManager.ts#L49)

Table relationship definition

## Properties

### type

> **type**: `"object"` \| `"array"`

Defined in: [packages/core/src/utils/SchemaManager.ts:51](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/utils/SchemaManager.ts#L51)

Type of relationship

***

### table

> **table**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:53](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/utils/SchemaManager.ts#L53)

Target table name

***

### propertyName

> **propertyName**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:55](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/utils/SchemaManager.ts#L55)

Property name in JSON output

***

### targetKey?

> `optional` **targetKey**: `string`

Defined in: [packages/core/src/utils/SchemaManager.ts:57](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/utils/SchemaManager.ts#L57)

Optional: Override target table's primary key
</div>
