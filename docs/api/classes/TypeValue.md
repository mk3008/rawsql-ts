<div v-pre>
# Class: TypeValue

Defined in: [packages/core/src/models/ValueComponent.ts:365](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/ValueComponent.ts#L365)

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new TypeValue**(`namespaces`, `name`, `argument`): `TypeValue`

Defined in: [packages/core/src/models/ValueComponent.ts:369](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/ValueComponent.ts#L369)

#### Parameters

##### namespaces

`null` | `string`[] | [`IdentifierString`](IdentifierString.md)[]

##### name

`string` | [`RawString`](RawString.md) | [`IdentifierString`](IdentifierString.md)

##### argument

`null` | [`ValueComponent`](../type-aliases/ValueComponent.md)

#### Returns

`TypeValue`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

***

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/ValueComponent.ts:366](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/ValueComponent.ts#L366)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### qualifiedName

> **qualifiedName**: [`QualifiedName`](QualifiedName.md)

Defined in: [packages/core/src/models/ValueComponent.ts:367](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/ValueComponent.ts#L367)

***

### argument

> **argument**: `null` \| [`ValueComponent`](../type-aliases/ValueComponent.md)

Defined in: [packages/core/src/models/ValueComponent.ts:368](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/ValueComponent.ts#L368)

## Accessors

### namespaces

#### Get Signature

> **get** **namespaces**(): `null` \| [`IdentifierString`](IdentifierString.md)[]

Defined in: [packages/core/src/models/ValueComponent.ts:377](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/ValueComponent.ts#L377)

For backward compatibility: returns the namespaces as IdentifierString[] | null (readonly)

##### Returns

`null` \| [`IdentifierString`](IdentifierString.md)[]

***

### name

#### Get Signature

> **get** **name**(): [`RawString`](RawString.md) \| [`IdentifierString`](IdentifierString.md)

Defined in: [packages/core/src/models/ValueComponent.ts:383](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/ValueComponent.ts#L383)

For backward compatibility: returns the type name as RawString | IdentifierString (readonly)

##### Returns

[`RawString`](RawString.md) \| [`IdentifierString`](IdentifierString.md)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)

***

### getTypeName()

> **getTypeName**(): `string`

Defined in: [packages/core/src/models/ValueComponent.ts:386](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/models/ValueComponent.ts#L386)

#### Returns

`string`
</div>
