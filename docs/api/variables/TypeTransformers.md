<div v-pre>
# Variable: TypeTransformers

> `const` **TypeTransformers**: `object`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:387](https://github.com/mk3008/rawsql-ts/blob/f6baf229d3797b57b781ecce6f8f038d2b6458c2/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L387)

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
