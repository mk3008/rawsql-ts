<div v-pre>
# Class: BinarySelectQuery

Defined in: [packages/core/src/models/BinarySelectQuery.ts:25](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L25)

Represents a binary SELECT expression (UNION/INTERSECT/EXCEPT) composed from two SelectQuery values.

## Example

```typescript
const parts = [
  SelectQueryParser.parse('SELECT id, name FROM users').toSimpleQuery(),
  SelectQueryParser.parse('SELECT id, name FROM archived_users').toSimpleQuery()
];
const unionQuery = QueryBuilder.buildBinaryQuery(parts, 'union');
```
Related tests: packages/core/tests/models/SelectQueryUnion.test.ts

## Extends

- [`SqlComponent`](SqlComponent.md)

## Implements

- [`SelectQuery`](../interfaces/SelectQuery.md)

## Constructors

### Constructor

> **new BinarySelectQuery**(`left`, `operator`, `right`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:33](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L33)

#### Parameters

##### left

[`SelectQuery`](../interfaces/SelectQuery.md)

##### operator

`string`

##### right

[`SelectQuery`](../interfaces/SelectQuery.md)

#### Returns

`BinarySelectQuery`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:26](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L26)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### \_\_selectQueryType

> `readonly` **\_\_selectQueryType**: `"SelectQuery"` = `'SelectQuery'`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:27](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L27)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`__selectQueryType`](../interfaces/SelectQuery.md#__selectquerytype)

***

### headerComments

> **headerComments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:28](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L28)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`headerComments`](../interfaces/SelectQuery.md#headercomments)

***

### left

> **left**: [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:29](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L29)

***

### operator

> **operator**: [`RawString`](RawString.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:30](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L30)

***

### right

> **right**: [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:31](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L31)

***

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

## Methods

### union()

> **union**(`query`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:48](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L48)

Appends another query to this binary query using UNION as the operator.
This creates a new BinarySelectQuery where the left side is this binary query
and the right side is the provided query.

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The query to append with UNION

#### Returns

`BinarySelectQuery`

A new BinarySelectQuery representing "(this) UNION query"

***

### unionAll()

> **unionAll**(`query`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:60](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L60)

Appends another query to this binary query using UNION ALL as the operator.
This creates a new BinarySelectQuery where the left side is this binary query
and the right side is the provided query.

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The query to append with UNION ALL

#### Returns

`BinarySelectQuery`

A new BinarySelectQuery representing "(this) UNION ALL query"

***

### intersect()

> **intersect**(`query`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:72](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L72)

Appends another query to this binary query using INTERSECT as the operator.
This creates a new BinarySelectQuery where the left side is this binary query
and the right side is the provided query.

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The query to append with INTERSECT

#### Returns

`BinarySelectQuery`

A new BinarySelectQuery representing "(this) INTERSECT query"

***

### intersectAll()

> **intersectAll**(`query`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:84](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L84)

Appends another query to this binary query using INTERSECT ALL as the operator.
This creates a new BinarySelectQuery where the left side is this binary query
and the right side is the provided query.

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The query to append with INTERSECT ALL

#### Returns

`BinarySelectQuery`

A new BinarySelectQuery representing "(this) INTERSECT ALL query"

***

### except()

> **except**(`query`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:96](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L96)

Appends another query to this binary query using EXCEPT as the operator.
This creates a new BinarySelectQuery where the left side is this binary query
and the right side is the provided query.

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The query to append with EXCEPT

#### Returns

`BinarySelectQuery`

A new BinarySelectQuery representing "(this) EXCEPT query"

***

### exceptAll()

> **exceptAll**(`query`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:108](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L108)

Appends another query to this binary query using EXCEPT ALL as the operator.
This creates a new BinarySelectQuery where the left side is this binary query
and the right side is the provided query.

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The query to append with EXCEPT ALL

#### Returns

`BinarySelectQuery`

A new BinarySelectQuery representing "(this) EXCEPT ALL query"

***

### appendSelectQuery()

> **appendSelectQuery**(`operator`, `query`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:121](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L121)

Appends another query to this binary query using the specified operator.
This creates a new BinarySelectQuery where the left side is this binary query
and the right side is the provided query.

#### Parameters

##### operator

`string`

SQL operator to use (e.g. 'union', 'union all', 'intersect', 'except')

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The query to append with the specified operator

#### Returns

`BinarySelectQuery`

A new BinarySelectQuery representing "(this) [operator] query"

***

### unionRaw()

> **unionRaw**(`sql`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:137](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L137)

Appends another query to this binary query using UNION as the operator, accepting a raw SQL string.
This method parses the SQL string and appends the resulting query using UNION.

#### Parameters

##### sql

`string`

The SQL string to parse and union

#### Returns

`BinarySelectQuery`

A new BinarySelectQuery representing "(this) UNION (parsed query)"

***

### unionAllRaw()

> **unionAllRaw**(`sql`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:141](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L141)

#### Parameters

##### sql

`string`

#### Returns

`BinarySelectQuery`

***

### intersectRaw()

> **intersectRaw**(`sql`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:145](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L145)

#### Parameters

##### sql

`string`

#### Returns

`BinarySelectQuery`

***

### intersectAllRaw()

> **intersectAllRaw**(`sql`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:149](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L149)

#### Parameters

##### sql

`string`

#### Returns

`BinarySelectQuery`

***

### exceptRaw()

> **exceptRaw**(`sql`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:153](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L153)

#### Parameters

##### sql

`string`

#### Returns

`BinarySelectQuery`

***

### exceptAllRaw()

> **exceptAllRaw**(`sql`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:157](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L157)

#### Parameters

##### sql

`string`

#### Returns

`BinarySelectQuery`

***

### toSource()

> **toSource**(`alias`): `SourceExpression`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:164](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L164)

#### Parameters

##### alias

`string` = `"subq"`

#### Returns

`SourceExpression`

***

### setParameter()

> **setParameter**(`name`, `value`): `this`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:176](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L176)

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

***

### toSimpleQuery()

> **toSimpleQuery**(): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:186](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/BinarySelectQuery.ts#L186)

Converts this BinarySelectQuery to a SimpleSelectQuery using QueryBuilder.
This enables CTE management on binary queries by wrapping them as subqueries.

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

A SimpleSelectQuery representation of this binary query

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toSimpleQuery`](../interfaces/SelectQuery.md#tosimplequery)

***

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
</div>
