<div v-pre>
# Class: ReferenceDefinition

Defined in: [packages/core/src/models/CreateTableQuery.ts:24](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L24)

Represents a REFERENCES clause definition that can be shared between column and table constraints.

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new ReferenceDefinition**(`params`): `ReferenceDefinition`

Defined in: [packages/core/src/models/CreateTableQuery.ts:34](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L34)

#### Parameters

##### params

###### targetTable

[`QualifiedName`](QualifiedName.md)

###### columns?

`null` \| [`IdentifierString`](IdentifierString.md)[]

###### matchType?

[`MatchType`](../type-aliases/MatchType.md)

###### onDelete?

`null` \| [`ReferentialAction`](../type-aliases/ReferentialAction.md)

###### onUpdate?

`null` \| [`ReferentialAction`](../type-aliases/ReferentialAction.md)

###### deferrable?

[`ConstraintDeferrability`](../type-aliases/ConstraintDeferrability.md)

###### initially?

[`ConstraintInitially`](../type-aliases/ConstraintInitially.md)

#### Returns

`ReferenceDefinition`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/CreateTableQuery.ts:25](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L25)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### targetTable

> **targetTable**: [`QualifiedName`](QualifiedName.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:26](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L26)

***

### columns

> **columns**: `null` \| [`IdentifierString`](IdentifierString.md)[]

Defined in: [packages/core/src/models/CreateTableQuery.ts:27](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L27)

***

### matchType

> **matchType**: [`MatchType`](../type-aliases/MatchType.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:28](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L28)

***

### onDelete

> **onDelete**: `null` \| [`ReferentialAction`](../type-aliases/ReferentialAction.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:29](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L29)

***

### onUpdate

> **onUpdate**: `null` \| [`ReferentialAction`](../type-aliases/ReferentialAction.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:30](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L30)

***

### deferrable

> **deferrable**: [`ConstraintDeferrability`](../type-aliases/ConstraintDeferrability.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:31](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L31)

***

### initially

> **initially**: [`ConstraintInitially`](../type-aliases/ConstraintInitially.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:32](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L32)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
