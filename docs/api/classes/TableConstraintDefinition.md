<div v-pre>
# Class: TableConstraintDefinition

Defined in: [packages/core/src/models/CreateTableQuery.ts:101](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/CreateTableQuery.ts#L101)

Table-level constraint definition.

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new TableConstraintDefinition**(`params`): `TableConstraintDefinition`

Defined in: [packages/core/src/models/CreateTableQuery.ts:112](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/CreateTableQuery.ts#L112)

#### Parameters

##### params

###### kind

[`TableConstraintKind`](../type-aliases/TableConstraintKind.md)

###### constraintName?

[`IdentifierString`](IdentifierString.md)

###### columns?

`null` \| [`IdentifierString`](IdentifierString.md)[]

###### reference?

[`ReferenceDefinition`](ReferenceDefinition.md)

###### checkExpression?

[`ValueComponent`](../type-aliases/ValueComponent.md)

###### rawClause?

[`RawString`](RawString.md)

###### deferrable?

[`ConstraintDeferrability`](../type-aliases/ConstraintDeferrability.md)

###### initially?

[`ConstraintInitially`](../type-aliases/ConstraintInitially.md)

#### Returns

`TableConstraintDefinition`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/CreateTableQuery.ts:102](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/CreateTableQuery.ts#L102)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### kind

> **kind**: [`TableConstraintKind`](../type-aliases/TableConstraintKind.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:103](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/CreateTableQuery.ts#L103)

***

### constraintName?

> `optional` **constraintName**: [`IdentifierString`](IdentifierString.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:104](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/CreateTableQuery.ts#L104)

***

### columns

> **columns**: `null` \| [`IdentifierString`](IdentifierString.md)[]

Defined in: [packages/core/src/models/CreateTableQuery.ts:105](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/CreateTableQuery.ts#L105)

***

### reference?

> `optional` **reference**: [`ReferenceDefinition`](ReferenceDefinition.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:106](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/CreateTableQuery.ts#L106)

***

### checkExpression?

> `optional` **checkExpression**: [`ValueComponent`](../type-aliases/ValueComponent.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:107](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/CreateTableQuery.ts#L107)

***

### rawClause?

> `optional` **rawClause**: [`RawString`](RawString.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:108](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/CreateTableQuery.ts#L108)

***

### deferrable

> **deferrable**: [`ConstraintDeferrability`](../type-aliases/ConstraintDeferrability.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:109](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/CreateTableQuery.ts#L109)

***

### initially

> **initially**: [`ConstraintInitially`](../type-aliases/ConstraintInitially.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:110](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/CreateTableQuery.ts#L110)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
