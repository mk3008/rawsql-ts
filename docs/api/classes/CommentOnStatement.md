<div v-pre>
# Class: CommentOnStatement

Defined in: [packages/core/src/models/DDLStatements.ts:114](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/DDLStatements.ts#L114)

COMMENT ON TABLE/COLUMN statement representation.

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new CommentOnStatement**(`params`): `CommentOnStatement`

Defined in: [packages/core/src/models/DDLStatements.ts:120](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/DDLStatements.ts#L120)

#### Parameters

##### params

###### targetKind

[`CommentTargetKind`](../type-aliases/CommentTargetKind.md)

###### target

[`QualifiedName`](QualifiedName.md)

###### comment

`null` \| [`ValueComponent`](../type-aliases/ValueComponent.md)

#### Returns

`CommentOnStatement`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/DDLStatements.ts:115](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/DDLStatements.ts#L115)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### targetKind

> **targetKind**: [`CommentTargetKind`](../type-aliases/CommentTargetKind.md)

Defined in: [packages/core/src/models/DDLStatements.ts:116](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/DDLStatements.ts#L116)

***

### target

> **target**: [`QualifiedName`](QualifiedName.md)

Defined in: [packages/core/src/models/DDLStatements.ts:117](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/DDLStatements.ts#L117)

***

### comment

> **comment**: `null` \| [`ValueComponent`](../type-aliases/ValueComponent.md)

Defined in: [packages/core/src/models/DDLStatements.ts:118](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/DDLStatements.ts#L118)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/b1d59a6317b920d69108eb2049117d9588f8670b/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
