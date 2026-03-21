<div v-pre>
# Class: ClusterStatement

Defined in: [packages/core/src/models/DDLStatements.ts:554](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/DDLStatements.ts#L554)

CLUSTER statement representation.

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new ClusterStatement**(`params?`): `ClusterStatement`

Defined in: [packages/core/src/models/DDLStatements.ts:560](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/DDLStatements.ts#L560)

#### Parameters

##### params?

###### verbose?

`boolean`

###### table?

`null` \| [`QualifiedName`](QualifiedName.md)

###### index?

`null` \| [`QualifiedName`](QualifiedName.md)

#### Returns

`ClusterStatement`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/DDLStatements.ts:555](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/DDLStatements.ts#L555)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### verbose

> **verbose**: `boolean`

Defined in: [packages/core/src/models/DDLStatements.ts:556](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/DDLStatements.ts#L556)

***

### table

> **table**: `null` \| [`QualifiedName`](QualifiedName.md)

Defined in: [packages/core/src/models/DDLStatements.ts:557](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/DDLStatements.ts#L557)

***

### index

> **index**: `null` \| [`QualifiedName`](QualifiedName.md)

Defined in: [packages/core/src/models/DDLStatements.ts:558](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/DDLStatements.ts#L558)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/22d14b0a2fa0bd6d408a2f00790e0cbe52204d1a/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
