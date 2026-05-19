<div v-pre>
# ~~Class: Formatter~~

Defined in: [packages/core/src/transformers/Formatter.ts:9](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/Formatter.ts#L9)

## Deprecated

The Formatter class is deprecated. Use SqlFormatter instead.

## Implements

- [`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`string`\&gt;

## Constructors

### Constructor

> **new Formatter**(): `Formatter`

Defined in: [packages/core/src/transformers/Formatter.ts:12](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/Formatter.ts#L12)

#### Returns

`Formatter`

## Methods

### ~~format()~~

> **format**(`arg`, `config`): `string`

Defined in: [packages/core/src/transformers/Formatter.ts:20](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/Formatter.ts#L20)

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

##### config

`FormatterConfig` | `null`

#### Returns

`string`

***

### ~~formatWithParameters()~~

> **formatWithParameters**(`arg`, `config`): `object`

Defined in: [packages/core/src/transformers/Formatter.ts:29](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/Formatter.ts#L29)

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

##### config

`FormatterConfig` | `null`

#### Returns

`object`

##### ~~sql~~

> **sql**: `string`

##### ~~params~~

> **params**: `any`[] \| `Record`&lt;`string`, `any`\&gt; \| `Record`&lt;`string`, `any`\&gt;[]

***

### ~~visit()~~

> **visit**(`arg`): `string`

Defined in: [packages/core/src/transformers/Formatter.ts:38](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/Formatter.ts#L38)

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

#### Returns

`string`

#### Implementation of

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md).[`visit`](../interfaces/SqlComponentVisitor.md#visit)
</div>
