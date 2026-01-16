<div v-pre>
# Class: CreateIndexStatement

Defined in: [packages/core/src/models/DDLStatements.ts:139](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L139)

CREATE INDEX statement representation.

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new CreateIndexStatement**(`params`): `CreateIndexStatement`

Defined in: [packages/core/src/models/DDLStatements.ts:153](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L153)

#### Parameters

##### params

###### unique?

`boolean`

###### concurrently?

`boolean`

###### ifNotExists?

`boolean`

###### indexName

[`QualifiedName`](QualifiedName.md)

###### tableName

[`QualifiedName`](QualifiedName.md)

###### usingMethod?

`null` \| [`RawString`](RawString.md) \| [`IdentifierString`](IdentifierString.md)

###### columns

[`IndexColumnDefinition`](IndexColumnDefinition.md)[]

###### include?

`null` \| [`IdentifierString`](IdentifierString.md)[]

###### where?

[`ValueComponent`](../type-aliases/ValueComponent.md)

###### withOptions?

`null` \| [`RawString`](RawString.md)

###### tablespace?

`null` \| [`IdentifierString`](IdentifierString.md)

#### Returns

`CreateIndexStatement`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/DDLStatements.ts:140](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L140)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### unique

> **unique**: `boolean`

Defined in: [packages/core/src/models/DDLStatements.ts:141](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L141)

***

### concurrently

> **concurrently**: `boolean`

Defined in: [packages/core/src/models/DDLStatements.ts:142](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L142)

***

### ifNotExists

> **ifNotExists**: `boolean`

Defined in: [packages/core/src/models/DDLStatements.ts:143](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L143)

***

### indexName

> **indexName**: [`QualifiedName`](QualifiedName.md)

Defined in: [packages/core/src/models/DDLStatements.ts:144](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L144)

***

### tableName

> **tableName**: [`QualifiedName`](QualifiedName.md)

Defined in: [packages/core/src/models/DDLStatements.ts:145](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L145)

***

### usingMethod?

> `optional` **usingMethod**: `null` \| [`RawString`](RawString.md) \| [`IdentifierString`](IdentifierString.md)

Defined in: [packages/core/src/models/DDLStatements.ts:146](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L146)

***

### columns

> **columns**: [`IndexColumnDefinition`](IndexColumnDefinition.md)[]

Defined in: [packages/core/src/models/DDLStatements.ts:147](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L147)

***

### include?

> `optional` **include**: `null` \| [`IdentifierString`](IdentifierString.md)[]

Defined in: [packages/core/src/models/DDLStatements.ts:148](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L148)

***

### where?

> `optional` **where**: [`ValueComponent`](../type-aliases/ValueComponent.md)

Defined in: [packages/core/src/models/DDLStatements.ts:149](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L149)

***

### withOptions?

> `optional` **withOptions**: `null` \| [`RawString`](RawString.md)

Defined in: [packages/core/src/models/DDLStatements.ts:150](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L150)

***

### tablespace?

> `optional` **tablespace**: `null` \| [`IdentifierString`](IdentifierString.md)

Defined in: [packages/core/src/models/DDLStatements.ts:151](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/DDLStatements.ts#L151)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
