<div v-pre>
# Class: ParameterExpression

Defined in: [packages/core/src/models/ValueComponent.ts:228](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/ValueComponent.ts#L228)

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new ParameterExpression**(`name`, `value`): `ParameterExpression`

Defined in: [packages/core/src/models/ValueComponent.ts:237](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/ValueComponent.ts#L237)

#### Parameters

##### name

`string`

##### value

[`SqlParameterValue`](../type-aliases/SqlParameterValue.md) = `null`

#### Returns

`ParameterExpression`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

***

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/ValueComponent.ts:229](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/ValueComponent.ts#L229)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### name

> **name**: [`RawString`](RawString.md)

Defined in: [packages/core/src/models/ValueComponent.ts:230](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/ValueComponent.ts#L230)

***

### value

> **value**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/models/ValueComponent.ts:231](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/ValueComponent.ts#L231)

***

### index

> **index**: `null` \| `number`

Defined in: [packages/core/src/models/ValueComponent.ts:236](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/ValueComponent.ts#L236)

The index assigned by the formatter when generating parameterized queries.
Used for naming parameters like $1, $2, etc.

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
