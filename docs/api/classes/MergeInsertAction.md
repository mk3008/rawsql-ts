<div v-pre>
# Class: MergeInsertAction

Defined in: [packages/core/src/models/MergeQuery.ts:33](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/MergeQuery.ts#L33)

## Extends

- [`MergeAction`](MergeAction.md)

## Constructors

### Constructor

> **new MergeInsertAction**(`params`): `MergeInsertAction`

Defined in: [packages/core/src/models/MergeQuery.ts:40](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/MergeQuery.ts#L40)

#### Parameters

##### params

###### columns?

`null` \| (`string` \| [`IdentifierString`](IdentifierString.md))[]

###### values?

`null` \| [`ValueList`](ValueList.md)

###### defaultValues?

`boolean`

###### valuesLeadingComments?

`null` \| `string`[]

#### Returns

`MergeInsertAction`

#### Overrides

[`MergeAction`](MergeAction.md).[`constructor`](MergeAction.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/MergeQuery.ts:34](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/MergeQuery.ts#L34)

#### Overrides

[`MergeAction`](MergeAction.md).[`kind`](MergeAction.md#kind)

***

### columns

> **columns**: `null` \| [`IdentifierString`](IdentifierString.md)[]

Defined in: [packages/core/src/models/MergeQuery.ts:35](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/MergeQuery.ts#L35)

***

### values

> **values**: `null` \| [`ValueList`](ValueList.md)

Defined in: [packages/core/src/models/MergeQuery.ts:36](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/MergeQuery.ts#L36)

***

### defaultValues

> **defaultValues**: `boolean`

Defined in: [packages/core/src/models/MergeQuery.ts:37](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/MergeQuery.ts#L37)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`MergeAction`](MergeAction.md).[`comments`](MergeAction.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`MergeAction`](MergeAction.md).[`positionedComments`](MergeAction.md#positionedcomments)

## Methods

### addValuesLeadingComments()

> **addValuesLeadingComments**(`comments`): `void`

Defined in: [packages/core/src/models/MergeQuery.ts:55](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/MergeQuery.ts#L55)

#### Parameters

##### comments

`string`[]

#### Returns

`void`

***

### getValuesLeadingComments()

> **getValuesLeadingComments**(): `string`[]

Defined in: [packages/core/src/models/MergeQuery.ts:69](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/MergeQuery.ts#L69)

#### Returns

`string`[]

***

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`MergeAction`](MergeAction.md).[`getKind`](MergeAction.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/SqlComponent.ts#L19)

#### Type Parameters

##### T

`T`

#### Parameters

##### visitor

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`T`\&gt;

#### Returns

`T`

#### Inherited from

[`MergeAction`](MergeAction.md).[`accept`](MergeAction.md#accept)

***

### toSqlString()

> **toSqlString**(`formatter`): `string`

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/SqlComponent.ts#L23)

#### Parameters

##### formatter

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`string`\&gt;

#### Returns

`string`

#### Inherited from

[`MergeAction`](MergeAction.md).[`toSqlString`](MergeAction.md#tosqlstring)

***

### addPositionedComments()

> **addPositionedComments**(`position`, `comments`): `void`

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/SqlComponent.ts#L37)

Add comments at a specific position

#### Parameters

##### position

`"before"` | `"after"`

##### comments

`string`[]

#### Returns

`void`

#### Inherited from

[`MergeAction`](MergeAction.md).[`addPositionedComments`](MergeAction.md#addpositionedcomments)

***

### getPositionedComments()

> **getPositionedComments**(`position`): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/SqlComponent.ts#L56)

Get comments for a specific position

#### Parameters

##### position

`"before"` | `"after"`

#### Returns

`string`[]

#### Inherited from

[`MergeAction`](MergeAction.md).[`getPositionedComments`](MergeAction.md#getpositionedcomments)

***

### getAllPositionedComments()

> **getAllPositionedComments**(): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`MergeAction`](MergeAction.md).[`getAllPositionedComments`](MergeAction.md#getallpositionedcomments)
</div>
