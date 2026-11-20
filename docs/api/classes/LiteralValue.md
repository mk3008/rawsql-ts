<div v-pre>
# Class: LiteralValue

Defined in: [ValueComponent.ts:220](https://github.com/mk3008/rawsql-ts/blob/94cee17f2e322fec77f0341a44d81e1aa22fceb1/packages/core/src/models/ValueComponent.ts#L220)

Parsed single-quoted strings store the original text inside the quotes and set `isEscaped` to `true`.

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Single-quoted string

```ts
new LiteralValue(value: string, _deprecated: boolean | undefined, isStringLiteral: true, options: { isEscaped: boolean })
```

Defined in: [ValueComponent.ts:227](https://github.com/mk3008/rawsql-ts/blob/94cee17f2e322fec77f0341a44d81e1aa22fceb1/packages/core/src/models/ValueComponent.ts#L227)

Pass `{ isEscaped: false }` for plain string data or `{ isEscaped: true }` for text already escaped for the target SQL. Provide the value without the surrounding quotes.

### Other literals

```ts
new LiteralValue(value: string | number | boolean | null, _deprecated?: boolean, isStringLiteral?: false)
```

Defined in: [ValueComponent.ts:228](https://github.com/mk3008/rawsql-ts/blob/94cee17f2e322fec77f0341a44d81e1aa22fceb1/packages/core/src/models/ValueComponent.ts#L228)

## Properties

### comments

> **comments**: `string`[] \| `null` = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: [`PositionedComment`](../interfaces/PositionedComment.md)[] \| `null` = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

***

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/ValueComponent.ts:215](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/models/ValueComponent.ts#L215)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### value

> **value**: `string` \| `number` \| `boolean` \| `null`

For a single-quoted string, this holds the text inside the quotes. Use [`setStringValue`](#setstringvalue) to update it.

Defined in: [ValueComponent.ts:222](https://github.com/mk3008/rawsql-ts/blob/94cee17f2e322fec77f0341a44d81e1aa22fceb1/packages/core/src/models/ValueComponent.ts#L222)

***

### isStringLiteral?

> `readonly` `optional` **isStringLiteral**: `boolean`

Indicates that the formatter should enclose the value in single quotes.

Defined in: [ValueComponent.ts:223](https://github.com/mk3008/rawsql-ts/blob/94cee17f2e322fec77f0341a44d81e1aa22fceb1/packages/core/src/models/ValueComponent.ts#L223)

***

### isEscaped?

> `readonly` `optional` **isEscaped**: `boolean`

For single-quoted strings, `true` means the formatter uses the text as supplied between the quotes. `false` means the formatter escapes the plain string data before adding the quotes.

Defined in: [ValueComponent.ts:225](https://github.com/mk3008/rawsql-ts/blob/94cee17f2e322fec77f0341a44d81e1aa22fceb1/packages/core/src/models/ValueComponent.ts#L225)

## Methods

### setStringValue()

```ts
setStringValue(value: string, options: { isEscaped: boolean }): void
```

Updates the text and escape state of an existing single-quoted string literal.

Defined in: [ValueComponent.ts:238](https://github.com/mk3008/rawsql-ts/blob/94cee17f2e322fec77f0341a44d81e1aa22fceb1/packages/core/src/models/ValueComponent.ts#L238)

```ts
const literal = new LiteralValue("O'Brien", undefined, true, { isEscaped: false });
literal.setStringValue("O''Neill", { isEscaped: true });
```

***

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/models/SqlComponent.ts#L19)

#### Type Parameters

##### T

`T`

#### Parameters

##### visitor

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`T`\&gt;

#### Returns

`T`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`accept`](SqlComponent.md#accept)

***

### toSqlString()

> **toSqlString**(`formatter`): `string`

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/models/SqlComponent.ts#L23)

#### Parameters

##### formatter

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`string`\&gt;

#### Returns

`string`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`toSqlString`](SqlComponent.md#tosqlstring)

***

### addPositionedComments()

> **addPositionedComments**(`position`, `comments`): `void`

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/models/SqlComponent.ts#L37)

Add comments at a specific position

#### Parameters

##### position

`"before"` | `"after"`

##### comments

`string`[]

#### Returns

`void`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`addPositionedComments`](SqlComponent.md#addpositionedcomments)

***

### getPositionedComments()

> **getPositionedComments**(`position`): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/models/SqlComponent.ts#L56)

Get comments for a specific position

#### Parameters

##### position

`"before"` | `"after"`

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getPositionedComments`](SqlComponent.md#getpositionedcomments)

***

### getAllPositionedComments()

> **getAllPositionedComments**(): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
