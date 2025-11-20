<div v-pre>
# Class: ArrayIndexExpression

Defined in: [packages/core/src/models/ValueComponent.ts:418](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/ValueComponent.ts#L418)

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new ArrayIndexExpression**(`array`, `index`): `ArrayIndexExpression`

Defined in: [packages/core/src/models/ValueComponent.ts:422](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/ValueComponent.ts#L422)

#### Parameters

##### array

[`ValueComponent`](../type-aliases/ValueComponent.md)

##### index

[`ValueComponent`](../type-aliases/ValueComponent.md)

#### Returns

`ArrayIndexExpression`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

***

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/ValueComponent.ts:419](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/ValueComponent.ts#L419)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### array

> **array**: [`ValueComponent`](../type-aliases/ValueComponent.md)

Defined in: [packages/core/src/models/ValueComponent.ts:420](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/ValueComponent.ts#L420)

***

### index

> **index**: [`ValueComponent`](../type-aliases/ValueComponent.md)

Defined in: [packages/core/src/models/ValueComponent.ts:421](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/ValueComponent.ts#L421)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
