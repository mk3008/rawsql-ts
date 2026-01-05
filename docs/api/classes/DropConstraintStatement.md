<div v-pre>
# Class: DropConstraintStatement

Defined in: [packages/core/src/models/DDLStatements.ts:327](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/DDLStatements.ts#L327)

Standalone DROP CONSTRAINT statement representation.

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new DropConstraintStatement**(`params`): `DropConstraintStatement`

Defined in: [packages/core/src/models/DDLStatements.ts:333](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/DDLStatements.ts#L333)

#### Parameters

##### params

###### constraintName

[`IdentifierString`](IdentifierString.md)

###### ifExists?

`boolean`

###### behavior?

[`DropBehavior`](../type-aliases/DropBehavior.md)

#### Returns

`DropConstraintStatement`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/DDLStatements.ts:328](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/DDLStatements.ts#L328)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### constraintName

> **constraintName**: [`IdentifierString`](IdentifierString.md)

Defined in: [packages/core/src/models/DDLStatements.ts:329](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/DDLStatements.ts#L329)

***

### ifExists

> **ifExists**: `boolean`

Defined in: [packages/core/src/models/DDLStatements.ts:330](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/DDLStatements.ts#L330)

***

### behavior

> **behavior**: [`DropBehavior`](../type-aliases/DropBehavior.md)

Defined in: [packages/core/src/models/DDLStatements.ts:331](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/DDLStatements.ts#L331)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
