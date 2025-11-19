<div v-pre>
# Interface: ColumnConfig

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:14](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/EnhancedJsonMapping.ts#L14)

Enhanced column configuration that supports both simple and complex mappings.

## Properties

### column

> **column**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:16](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/EnhancedJsonMapping.ts#L16)

Source column name

***

### type?

> `optional` **type**: [`ColumnType`](../type-aliases/ColumnType.md)

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:18](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/EnhancedJsonMapping.ts#L18)

Type enforcement for this column

***

### nullable?

> `optional` **nullable**: `boolean`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:20](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/EnhancedJsonMapping.ts#L20)

Whether this field is nullable

***

### transform?

> `optional` **transform**: `string`

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:22](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/EnhancedJsonMapping.ts#L22)

Custom transformation function
</div>
