<div v-pre>
# Class: MergeUpdateAction

Defined in: [packages/core/src/models/MergeQuery.ts:11](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/MergeQuery.ts#L11)

## Extends

- [`MergeAction`](MergeAction.md)

## Constructors

### Constructor

> **new MergeUpdateAction**(`setClause`, `whereClause?`): `MergeUpdateAction`

Defined in: [packages/core/src/models/MergeQuery.ts:16](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/MergeQuery.ts#L16)

#### Parameters

##### setClause

`SetClause` | `SetClauseItem`[]

##### whereClause?

`null` | `WhereClause`

#### Returns

`MergeUpdateAction`

#### Overrides

[`MergeAction`](MergeAction.md).[`constructor`](MergeAction.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/MergeQuery.ts:12](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/MergeQuery.ts#L12)

#### Overrides

[`MergeAction`](MergeAction.md).[`kind`](MergeAction.md#kind)

***

### setClause

> **setClause**: `SetClause`

Defined in: [packages/core/src/models/MergeQuery.ts:13](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/MergeQuery.ts#L13)

***

### whereClause

> **whereClause**: `null` \| `WhereClause`

Defined in: [packages/core/src/models/MergeQuery.ts:14](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/MergeQuery.ts#L14)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`MergeAction`](MergeAction.md).[`comments`](MergeAction.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`MergeAction`](MergeAction.md).[`positionedComments`](MergeAction.md#positionedcomments)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`MergeAction`](MergeAction.md).[`getKind`](MergeAction.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`MergeAction`](MergeAction.md).[`getAllPositionedComments`](MergeAction.md#getallpositionedcomments)
</div>
