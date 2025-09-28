<div v-pre>
# Variable: TypeTransformers

> `const` **TypeTransformers**: `object`

Defined in: [packages/core/src/transformers/TypeTransformationPostProcessor.ts:387](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/TypeTransformationPostProcessor.ts#L387)

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
