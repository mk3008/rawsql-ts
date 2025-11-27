<div v-pre>
# Interface: TypeTransformationConfig

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:6](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L6)

Post-processor for transforming database values to appropriate TypeScript types
after JSON serialization from PostgreSQL

## Properties

### columnTransformations?

> `optional` **columnTransformations**: `object`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:8](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L8)

Column transformations mapping - takes precedence over value-based detection

#### Index Signature

\[`columnName`: `string`\]: [`TypeTransformation`](TypeTransformation.md)

***

### globalTransformations?

> `optional` **globalTransformations**: `object`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:12](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L12)

Global transformation rules by SQL data type

#### Index Signature

\[`sqlType`: `string`\]: [`TypeTransformation`](TypeTransformation.md)

***

### customTransformers?

> `optional` **customTransformers**: `object`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:16](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L16)

Custom transformation functions

#### Index Signature

\[`transformerName`: `string`\]: (`value`) => `unknown`

***

### enableValueBasedDetection?

> `optional` **enableValueBasedDetection**: `boolean`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:20](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L20)

Enable value-based type detection when column mapping is not provided (default: true)

***

### strictDateDetection?

> `optional` **strictDateDetection**: `boolean`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:22](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L22)

Strict date detection - only convert ISO 8601 with 'T' separator (default: false)
</div>
