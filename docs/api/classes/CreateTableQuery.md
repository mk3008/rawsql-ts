<div v-pre>
# Class: CreateTableQuery

Defined in: [packages/core/src/models/CreateTableQuery.ts:156](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L156)

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new CreateTableQuery**(`params`): `CreateTableQuery`

Defined in: [packages/core/src/models/CreateTableQuery.ts:168](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L168)

#### Parameters

##### params

###### tableName

`string`

###### namespaces?

`null` \| `string`[]

###### isTemporary?

`boolean`

###### ifNotExists?

`boolean`

###### columns?

[`TableColumnDefinition`](TableColumnDefinition.md)[]

###### tableConstraints?

[`TableConstraintDefinition`](TableConstraintDefinition.md)[]

###### tableOptions?

`null` \| [`RawString`](RawString.md)

###### asSelectQuery?

[`SelectQuery`](../interfaces/SelectQuery.md)

###### withDataOption?

`null` \| `"with-data"` \| `"with-no-data"`

#### Returns

`CreateTableQuery`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/CreateTableQuery.ts:157](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L157)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### tableName

> **tableName**: [`IdentifierString`](IdentifierString.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:158](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L158)

***

### namespaces

> **namespaces**: `null` \| `string`[]

Defined in: [packages/core/src/models/CreateTableQuery.ts:159](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L159)

***

### isTemporary

> **isTemporary**: `boolean`

Defined in: [packages/core/src/models/CreateTableQuery.ts:160](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L160)

***

### ifNotExists

> **ifNotExists**: `boolean`

Defined in: [packages/core/src/models/CreateTableQuery.ts:161](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L161)

***

### columns

> **columns**: [`TableColumnDefinition`](TableColumnDefinition.md)[]

Defined in: [packages/core/src/models/CreateTableQuery.ts:162](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L162)

***

### tableConstraints

> **tableConstraints**: [`TableConstraintDefinition`](TableConstraintDefinition.md)[]

Defined in: [packages/core/src/models/CreateTableQuery.ts:163](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L163)

***

### tableOptions?

> `optional` **tableOptions**: `null` \| [`RawString`](RawString.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:164](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L164)

***

### asSelectQuery?

> `optional` **asSelectQuery**: [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:165](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L165)

***

### withDataOption

> **withDataOption**: `null` \| `"with-data"` \| `"with-no-data"`

Defined in: [packages/core/src/models/CreateTableQuery.ts:166](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L166)

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

### getSelectQuery()

> **getSelectQuery**(): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:194](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L194)

Returns a SelectQuery that selects all columns from this table.

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

***

### getCountQuery()

> **getCountQuery**(): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/models/CreateTableQuery.ts:233](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/CreateTableQuery.ts#L233)

Returns a SelectQuery that counts all rows in this table.

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

***

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
