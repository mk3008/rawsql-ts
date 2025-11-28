<div v-pre>
# Interface: TypeTransformation

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:25](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L25)

## Properties

### sourceType

> **sourceType**: `"NUMERIC"` \| `"TIMESTAMP"` \| `"DATE"` \| `"BIGINT"` \| `"JSONB"` \| `"custom"`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:27](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L27)

Source SQL data type

***

### targetType

> **targetType**: `"string"` \| `"number"` \| `"bigint"` \| `"object"` \| `"custom"` \| `"Date"`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:29](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L29)

Target TypeScript type representation

***

### customTransformer?

> `optional` **customTransformer**: `string`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:31](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L31)

Custom transformer function name (for custom type)

***

### handleNull?

> `optional` **handleNull**: `boolean`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:33](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L33)

Whether to handle null values (default: true)

***

### validator()?

> `optional` **validator**: (`value`) => `boolean`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:35](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L35)

Validation function for the value

#### Parameters

##### value

`unknown`

#### Returns

`boolean`
</div>
