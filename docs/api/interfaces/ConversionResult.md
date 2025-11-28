<div v-pre>
# Interface: ConversionResult

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:26](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/JsonMappingConverter.ts#L26)

Conversion result with metadata.

## Properties

### format

> **format**: [`MappingFormat`](../type-aliases/MappingFormat.md)

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:28](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/JsonMappingConverter.ts#L28)

Detected input format

***

### mapping

> **mapping**: [`JsonMapping`](JsonMapping.md)

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:30](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/JsonMappingConverter.ts#L30)

Converted legacy mapping for PostgresJsonQueryBuilder

***

### typeProtection

> **typeProtection**: [`TypeProtectionConfig`](TypeProtectionConfig.md)

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:32](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/JsonMappingConverter.ts#L32)

Type protection configuration

***

### originalInput

> **originalInput**: [`JsonMappingInput`](../type-aliases/JsonMappingInput.md)

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:34](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/JsonMappingConverter.ts#L34)

Original input for reference

***

### metadata?

> `optional` **metadata**: `object`

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:36](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/JsonMappingConverter.ts#L36)

Additional metadata

#### typeInfo?

> `optional` **typeInfo**: `object`

##### typeInfo.interface

> **interface**: `string`

##### typeInfo.importPath

> **importPath**: `string`

##### typeInfo.generics?

> `optional` **generics**: `string`[]

#### version?

> `optional` **version**: `string`

#### description?

> `optional` **description**: `string`
</div>
