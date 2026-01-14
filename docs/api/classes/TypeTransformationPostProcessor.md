<div v-pre>
# Class: TypeTransformationPostProcessor

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:41](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L41)

Applies type transformations to JSON results from PostgreSQL

## Constructors

### Constructor

> **new TypeTransformationPostProcessor**(`config`): `TypeTransformationPostProcessor`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:42](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L42)

#### Parameters

##### config

[`TypeTransformationConfig`](../interfaces/TypeTransformationConfig.md) = `{}`

#### Returns

`TypeTransformationPostProcessor`

## Methods

### transformResult()

> **transformResult**&lt;`T`\&gt;(`result`): `T`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:55](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L55)

Transform a single result object

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### result

`unknown`

The result object from PostgreSQL JSON query

#### Returns

`T`

Transformed result with proper TypeScript types

***

### createDefaultConfig()

> `static` **createDefaultConfig**(): [`TypeTransformationConfig`](../interfaces/TypeTransformationConfig.md)

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:291](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L291)

Create a default configuration for common PostgreSQL types
Enables value-based detection with loose date detection by default

#### Returns

[`TypeTransformationConfig`](../interfaces/TypeTransformationConfig.md)

***

### createSafeConfig()

> `static` **createSafeConfig**(`columnMappings?`): [`TypeTransformationConfig`](../interfaces/TypeTransformationConfig.md)

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:332](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L332)

Create a safe configuration for handling user input
Disables value-based detection and uses strict date detection

#### Parameters

##### columnMappings?

#### Returns

[`TypeTransformationConfig`](../interfaces/TypeTransformationConfig.md)
</div>
