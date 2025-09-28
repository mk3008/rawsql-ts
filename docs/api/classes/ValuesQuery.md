<div v-pre>
# Class: ValuesQuery

Defined in: [packages/core/src/models/ValuesQuery.ts:13](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/ValuesQuery.ts#L13)

Represents a VALUES query in SQL.

## Extends

- [`SqlComponent`](SqlComponent.md)

## Implements

- [`SelectQuery`](../interfaces/SelectQuery.md)

## Constructors

### Constructor

> **new ValuesQuery**(`tuples`, `columnAliases`): `ValuesQuery`

Defined in: [packages/core/src/models/ValuesQuery.ts:25](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/ValuesQuery.ts#L25)

#### Parameters

##### tuples

[`TupleExpression`](TupleExpression.md)[]

##### columnAliases

`null` | `string`[]

#### Returns

`ValuesQuery`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:27](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L27)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`comments`](../interfaces/SelectQuery.md#comments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:30](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L30)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`positionedComments`](../interfaces/SelectQuery.md#positionedcomments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

***

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/ValuesQuery.ts:14](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/ValuesQuery.ts#L14)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### \_\_selectQueryType

> `readonly` **\_\_selectQueryType**: `"SelectQuery"` = `'SelectQuery'`

Defined in: [packages/core/src/models/ValuesQuery.ts:15](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/ValuesQuery.ts#L15)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`__selectQueryType`](../interfaces/SelectQuery.md#__selectquerytype)

***

### headerComments

> **headerComments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/ValuesQuery.ts:16](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/ValuesQuery.ts#L16)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`headerComments`](../interfaces/SelectQuery.md#headercomments)

***

### tuples

> **tuples**: [`TupleExpression`](TupleExpression.md)[]

Defined in: [packages/core/src/models/ValuesQuery.ts:17](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/ValuesQuery.ts#L17)

***

### columnAliases

> **columnAliases**: `null` \| `string`[]

Defined in: [packages/core/src/models/ValuesQuery.ts:23](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/ValuesQuery.ts#L23)

Column aliases for the VALUES query.
These represent the logical column names for each value tuple.
Note: This property is optional and is not referenced during SQL output, but is used when converting to a SimpleSelectQuery.

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:13](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L13)

#### Returns

`symbol`

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`getKind`](../interfaces/SelectQuery.md#getkind)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:17](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L17)

#### Type Parameters

##### T

`T`

#### Parameters

##### visitor

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`T`\&gt;

#### Returns

`T`

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`accept`](../interfaces/SelectQuery.md#accept)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`accept`](SqlComponent.md#accept)

***

### toSqlString()

> **toSqlString**(`formatter`): `string`

Defined in: [packages/core/src/models/SqlComponent.ts:21](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L21)

#### Parameters

##### formatter

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`string`\&gt;

#### Returns

`string`

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toSqlString`](../interfaces/SelectQuery.md#tosqlstring)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`toSqlString`](SqlComponent.md#tosqlstring)

***

### addPositionedComments()

> **addPositionedComments**(`position`, `comments`): `void`

Defined in: [packages/core/src/models/SqlComponent.ts:35](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L35)

Add comments at a specific position

#### Parameters

##### position

`"before"` | `"after"`

##### comments

`string`[]

#### Returns

`void`

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`addPositionedComments`](../interfaces/SelectQuery.md#addpositionedcomments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`addPositionedComments`](SqlComponent.md#addpositionedcomments)

***

### getPositionedComments()

> **getPositionedComments**(`position`): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:54](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L54)

Get comments for a specific position

#### Parameters

##### position

`"before"` | `"after"`

#### Returns

`string`[]

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`getPositionedComments`](../interfaces/SelectQuery.md#getpositionedcomments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getPositionedComments`](SqlComponent.md#getpositionedcomments)

***

### getAllPositionedComments()

> **getAllPositionedComments**(): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:64](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L64)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`getAllPositionedComments`](../interfaces/SelectQuery.md#getallpositionedcomments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)

***

### toSimpleQuery()

> **toSimpleQuery**(): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/models/ValuesQuery.ts:31](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/ValuesQuery.ts#L31)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toSimpleQuery`](../interfaces/SelectQuery.md#tosimplequery)

***

### setParameter()

> **setParameter**(`name`, `value`): `this`

Defined in: [packages/core/src/models/ValuesQuery.ts:40](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/ValuesQuery.ts#L40)

Sets the value of a parameter by name in this query.

#### Parameters

##### name

`string`

Parameter name

##### value

[`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Value to set

#### Returns

`this`

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`setParameter`](../interfaces/SelectQuery.md#setparameter)
</div>
