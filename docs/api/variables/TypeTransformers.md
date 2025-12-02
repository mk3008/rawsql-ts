<div v-pre>
# Variable: TypeTransformers

> `const` **TypeTransformers**: `object`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:387](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L387)

Type-safe transformation helpers

## Type Declaration

### toDate()

> **toDate**: (`value`) => `null` \| `Date`

Transform date string to Date object

#### Parameters

##### value

`null` | `string`

#### Returns

`null` \| `Date`

### toBigInt()

> **toBigInt**: (`value`) => `null` \| `bigint`

Transform numeric string to BigInt

#### Parameters

##### value

`null` | `string` | `number`

#### Returns

`null` \| `bigint`

### toObject()

> **toObject**: &lt;`T`\&gt;(`value`) => `null` \| `T`

Transform JSON string to object

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### value

`null` | `string`

#### Returns

`null` \| `T`
</div>
