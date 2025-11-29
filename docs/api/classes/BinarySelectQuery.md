<div v-pre>
# Class: BinarySelectQuery

Defined in: [packages/core/src/models/BinarySelectQuery.ts:34](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L34)

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

Defined in: [packages/core/src/models/BinarySelectQuery.ts:42](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L42)

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

Defined in: [packages/core/src/models/BinarySelectQuery.ts:35](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L35)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### \_\_selectQueryType

> `readonly` **\_\_selectQueryType**: `"SelectQuery"` = `'SelectQuery'`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:36](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L36)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`__selectQueryType`](../interfaces/SelectQuery.md#__selectquerytype)

***

### headerComments

> **headerComments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:37](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L37)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`headerComments`](../interfaces/SelectQuery.md#headercomments)

***

### left

> **left**: [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:38](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L38)

***

### operator

> **operator**: [`RawString`](RawString.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:39](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L39)

***

### right

> **right**: [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:40](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L40)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L29)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`comments`](../interfaces/SelectQuery.md#comments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L32)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`positionedComments`](../interfaces/SelectQuery.md#positionedcomments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Methods

### union()

> **union**(`query`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:57](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L57)

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

Defined in: [packages/core/src/models/BinarySelectQuery.ts:69](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L69)

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

Defined in: [packages/core/src/models/BinarySelectQuery.ts:81](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L81)

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

Defined in: [packages/core/src/models/BinarySelectQuery.ts:93](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L93)

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

Defined in: [packages/core/src/models/BinarySelectQuery.ts:105](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L105)

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

Defined in: [packages/core/src/models/BinarySelectQuery.ts:117](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L117)

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

Defined in: [packages/core/src/models/BinarySelectQuery.ts:130](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L130)

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

Defined in: [packages/core/src/models/BinarySelectQuery.ts:146](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L146)

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

Defined in: [packages/core/src/models/BinarySelectQuery.ts:150](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L150)

#### Parameters

##### sql

`string`

#### Returns

`BinarySelectQuery`

***

### intersectRaw()

> **intersectRaw**(`sql`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:154](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L154)

#### Parameters

##### sql

`string`

#### Returns

`BinarySelectQuery`

***

### intersectAllRaw()

> **intersectAllRaw**(`sql`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:158](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L158)

#### Parameters

##### sql

`string`

#### Returns

`BinarySelectQuery`

***

### exceptRaw()

> **exceptRaw**(`sql`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:162](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L162)

#### Parameters

##### sql

`string`

#### Returns

`BinarySelectQuery`

***

### exceptAllRaw()

> **exceptAllRaw**(`sql`): `BinarySelectQuery`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:166](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L166)

#### Parameters

##### sql

`string`

#### Returns

`BinarySelectQuery`

***

### toInsertQuery()

> **toInsertQuery**(`options`): [`InsertQuery`](InsertQuery.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:175](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L175)

Converts this query into an INSERT statement definition.

#### Parameters

##### options

[`InsertQueryConversionOptions`](../interfaces/InsertQueryConversionOptions.md)

#### Returns

[`InsertQuery`](InsertQuery.md)

#### Remarks

The underlying simple query may be reordered so that column order matches the requested insert columns.

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toInsertQuery`](../interfaces/SelectQuery.md#toinsertquery)

***

### toUpdateQuery()

> **toUpdateQuery**(`options`): [`UpdateQuery`](UpdateQuery.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:183](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L183)

Converts this query into an UPDATE statement definition.

#### Parameters

##### options

[`UpdateQueryConversionOptions`](../interfaces/UpdateQueryConversionOptions.md)

#### Returns

[`UpdateQuery`](UpdateQuery.md)

#### Remarks

The conversion can reorder the SELECT list produced by [toSimpleQuery](#tosimplequery).

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toUpdateQuery`](../interfaces/SelectQuery.md#toupdatequery)

***

### toDeleteQuery()

> **toDeleteQuery**(`options`): [`DeleteQuery`](DeleteQuery.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:191](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L191)

Converts this query into a DELETE statement definition.

#### Parameters

##### options

[`DeleteQueryConversionOptions`](../interfaces/DeleteQueryConversionOptions.md)

#### Returns

[`DeleteQuery`](DeleteQuery.md)

#### Remarks

The conversion can reorder the SELECT list produced by [toSimpleQuery](#tosimplequery).

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toDeleteQuery`](../interfaces/SelectQuery.md#todeletequery)

***

### toMergeQuery()

> **toMergeQuery**(`options`): [`MergeQuery`](MergeQuery.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:199](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L199)

Converts this query into a MERGE statement definition.

#### Parameters

##### options

[`MergeQueryConversionOptions`](../interfaces/MergeQueryConversionOptions.md)

#### Returns

[`MergeQuery`](MergeQuery.md)

#### Remarks

The conversion can reorder the SELECT list produced by [toSimpleQuery](#tosimplequery).

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toMergeQuery`](../interfaces/SelectQuery.md#tomergequery)

***

### toSource()

> **toSource**(`alias`): [`SourceExpression`](SourceExpression.md)

Defined in: [packages/core/src/models/BinarySelectQuery.ts:205](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L205)

#### Parameters

##### alias

`string` = `"subq"`

#### Returns

[`SourceExpression`](SourceExpression.md)

***

### setParameter()

> **setParameter**(`name`, `value`): `this`

Defined in: [packages/core/src/models/BinarySelectQuery.ts:217](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L217)

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

Defined in: [packages/core/src/models/BinarySelectQuery.ts:227](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/BinarySelectQuery.ts#L227)

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

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`getKind`](../interfaces/SelectQuery.md#getkind)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`getAllPositionedComments`](../interfaces/SelectQuery.md#getallpositionedcomments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
