<div v-pre>
# Class: SimpleSelectQuery

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:32](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L32)

Represents a single SELECT statement with full clause support (WITH, JOIN, GROUP BY, etc.).
Provides the fluent CTE management API used throughout packages/core/tests/models/SelectQuery.cte-management.test.ts.

## Example

```typescript
const query = SelectQueryParser.parse('SELECT id, email FROM users').toSimpleQuery();
const active = SelectQueryParser.parse('SELECT id FROM users WHERE active = true');

query
  .addCTE('active_users', active)
  .toUnionAll(SelectQueryParser.parse('SELECT id, email FROM legacy_users'));
```

## Extends

- [`SqlComponent`](SqlComponent.md)

## Implements

- [`SelectQuery`](../interfaces/SelectQuery.md)
- [`CTEManagement`](../interfaces/CTEManagement.md)

## Constructors

### Constructor

> **new SimpleSelectQuery**(`params`): `SimpleSelectQuery`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:53](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L53)

#### Parameters

##### params

###### selectClause

`SelectClause`

###### fromClause?

`null` \| `FromClause`

###### whereClause?

`null` \| `WhereClause`

###### groupByClause?

`null` \| `GroupByClause`

###### havingClause?

`null` \| `HavingClause`

###### orderByClause?

`null` \| `OrderByClause`

###### windowClause?

`null` \| `WindowsClause`

###### limitClause?

`null` \| `LimitClause`

###### offsetClause?

`null` \| `OffsetClause`

###### fetchClause?

`null` \| `FetchClause`

###### forClause?

`null` \| `ForClause`

###### withClause?

`null` \| `WithClause`

#### Returns

`SimpleSelectQuery`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:34](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L34)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### \_\_selectQueryType

> `readonly` **\_\_selectQueryType**: `"SelectQuery"` = `'SelectQuery'`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:35](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L35)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`__selectQueryType`](../interfaces/SelectQuery.md#__selectquerytype)

***

### headerComments

> **headerComments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:36](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L36)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`headerComments`](../interfaces/SelectQuery.md#headercomments)

***

### withClause

> **withClause**: `null` \| `WithClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:37](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L37)

***

### selectClause

> **selectClause**: `SelectClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:38](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L38)

***

### fromClause

> **fromClause**: `null` \| `FromClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:39](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L39)

***

### whereClause

> **whereClause**: `null` \| `WhereClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:40](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L40)

***

### groupByClause

> **groupByClause**: `null` \| `GroupByClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:41](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L41)

***

### havingClause

> **havingClause**: `null` \| `HavingClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:42](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L42)

***

### orderByClause

> **orderByClause**: `null` \| `OrderByClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:43](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L43)

***

### windowClause

> **windowClause**: `null` \| `WindowsClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:44](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L44)

***

### limitClause

> **limitClause**: `null` \| `LimitClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:45](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L45)

***

### offsetClause

> **offsetClause**: `null` \| `OffsetClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:46](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L46)

***

### fetchClause

> **fetchClause**: `null` \| `FetchClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:47](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L47)

***

### forClause

> **forClause**: `null` \| `ForClause`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:48](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L48)

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

### toUnion()

> **toUnion**(`rightQuery`): [`BinarySelectQuery`](BinarySelectQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:106](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L106)

Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
using UNION as the operator.

#### Parameters

##### rightQuery

[`SelectQuery`](../interfaces/SelectQuery.md)

The right side of the UNION

#### Returns

[`BinarySelectQuery`](BinarySelectQuery.md)

A new BinarySelectQuery representing "this UNION rightQuery"

***

### toUnionAll()

> **toUnionAll**(`rightQuery`): [`BinarySelectQuery`](BinarySelectQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:117](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L117)

Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
using UNION ALL as the operator.

#### Parameters

##### rightQuery

[`SelectQuery`](../interfaces/SelectQuery.md)

The right side of the UNION ALL

#### Returns

[`BinarySelectQuery`](BinarySelectQuery.md)

A new BinarySelectQuery representing "this UNION ALL rightQuery"

***

### toIntersect()

> **toIntersect**(`rightQuery`): [`BinarySelectQuery`](BinarySelectQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:128](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L128)

Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
using INTERSECT as the operator.

#### Parameters

##### rightQuery

[`SelectQuery`](../interfaces/SelectQuery.md)

The right side of the INTERSECT

#### Returns

[`BinarySelectQuery`](BinarySelectQuery.md)

A new BinarySelectQuery representing "this INTERSECT rightQuery"

***

### toIntersectAll()

> **toIntersectAll**(`rightQuery`): [`BinarySelectQuery`](BinarySelectQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:139](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L139)

Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
using INTERSECT ALL as the operator.

#### Parameters

##### rightQuery

[`SelectQuery`](../interfaces/SelectQuery.md)

The right side of the INTERSECT ALL

#### Returns

[`BinarySelectQuery`](BinarySelectQuery.md)

A new BinarySelectQuery representing "this INTERSECT ALL rightQuery"

***

### toExcept()

> **toExcept**(`rightQuery`): [`BinarySelectQuery`](BinarySelectQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:150](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L150)

Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
using EXCEPT as the operator.

#### Parameters

##### rightQuery

[`SelectQuery`](../interfaces/SelectQuery.md)

The right side of the EXCEPT

#### Returns

[`BinarySelectQuery`](BinarySelectQuery.md)

A new BinarySelectQuery representing "this EXCEPT rightQuery"

***

### toExceptAll()

> **toExceptAll**(`rightQuery`): [`BinarySelectQuery`](BinarySelectQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:161](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L161)

Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
using EXCEPT ALL as the operator.

#### Parameters

##### rightQuery

[`SelectQuery`](../interfaces/SelectQuery.md)

The right side of the EXCEPT ALL

#### Returns

[`BinarySelectQuery`](BinarySelectQuery.md)

A new BinarySelectQuery representing "this EXCEPT ALL rightQuery"

***

### toBinaryQuery()

> **toBinaryQuery**(`operator`, `rightQuery`): [`BinarySelectQuery`](BinarySelectQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:173](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L173)

Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
using the specified operator.

#### Parameters

##### operator

`string`

SQL operator to use (e.g. 'union', 'union all', 'intersect', 'except')

##### rightQuery

[`SelectQuery`](../interfaces/SelectQuery.md)

The right side of the binary operation

#### Returns

[`BinarySelectQuery`](BinarySelectQuery.md)

A new BinarySelectQuery representing "this [operator] rightQuery"

***

### appendWhereRaw()

> **appendWhereRaw**(`rawCondition`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:183](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L183)

Appends a new condition to the query's WHERE clause using AND logic.
The condition is provided as a raw SQL string which is parsed internally.

#### Parameters

##### rawCondition

`string`

Raw SQL string representing the condition (e.g. "status = 'active'")

#### Returns

`void`

***

### appendWhere()

> **appendWhere**(`condition`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:194](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L194)

Appends a new condition to the query's WHERE clause using AND logic.
The condition is provided as a ValueComponent object.

#### Parameters

##### condition

[`ValueComponent`](../type-aliases/ValueComponent.md)

ValueComponent representing the condition

#### Returns

`void`

***

### appendHavingRaw()

> **appendHavingRaw**(`rawCondition`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:212](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L212)

Appends a new condition to the query's HAVING clause using AND logic.
The condition is provided as a raw SQL string which is parsed internally.

#### Parameters

##### rawCondition

`string`

Raw SQL string representing the condition (e.g. "count(*) > 5")

#### Returns

`void`

***

### appendHaving()

> **appendHaving**(`condition`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:223](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L223)

Appends a new condition to the query's HAVING clause using AND logic.
The condition is provided as a ValueComponent object.

#### Parameters

##### condition

[`ValueComponent`](../type-aliases/ValueComponent.md)

ValueComponent representing the condition

#### Returns

`void`

***

### innerJoinRaw()

> **innerJoinRaw**(`joinSourceRawText`, `alias`, `columns`, `resolver`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:241](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L241)

Appends an INNER JOIN clause to the query.

#### Parameters

##### joinSourceRawText

`string`

The table source text to join (e.g., "my_table", "schema.my_table")

##### alias

`string`

The alias for the joined table

##### columns

The columns to use for the join condition (e.g. ["user_id"] or "user_id")

`string` | `string`[]

##### resolver

`null` | [`TableColumnResolver`](../type-aliases/TableColumnResolver.md)

#### Returns

`void`

***

### leftJoinRaw()

> **leftJoinRaw**(`joinSourceRawText`, `alias`, `columns`, `resolver`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:251](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L251)

Appends a LEFT JOIN clause to the query.

#### Parameters

##### joinSourceRawText

`string`

The table source text to join

##### alias

`string`

The alias for the joined table

##### columns

The columns to use for the join condition

`string` | `string`[]

##### resolver

`null` | [`TableColumnResolver`](../type-aliases/TableColumnResolver.md)

#### Returns

`void`

***

### rightJoinRaw()

> **rightJoinRaw**(`joinSourceRawText`, `alias`, `columns`, `resolver`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:261](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L261)

Appends a RIGHT JOIN clause to the query.

#### Parameters

##### joinSourceRawText

`string`

The table source text to join

##### alias

`string`

The alias for the joined table

##### columns

The columns to use for the join condition

`string` | `string`[]

##### resolver

`null` | [`TableColumnResolver`](../type-aliases/TableColumnResolver.md)

#### Returns

`void`

***

### innerJoin()

> **innerJoin**(`sourceExpr`, `columns`, `resolver`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:270](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L270)

Appends an INNER JOIN clause to the query using a SourceExpression.

#### Parameters

##### sourceExpr

`SourceExpression`

The source expression to join

##### columns

The columns to use for the join condition

`string` | `string`[]

##### resolver

`null` | [`TableColumnResolver`](../type-aliases/TableColumnResolver.md)

#### Returns

`void`

***

### leftJoin()

> **leftJoin**(`sourceExpr`, `columns`, `resolver`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:279](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L279)

Appends a LEFT JOIN clause to the query using a SourceExpression.

#### Parameters

##### sourceExpr

`SourceExpression`

The source expression to join

##### columns

The columns to use for the join condition

`string` | `string`[]

##### resolver

`null` | [`TableColumnResolver`](../type-aliases/TableColumnResolver.md)

#### Returns

`void`

***

### rightJoin()

> **rightJoin**(`sourceExpr`, `columns`, `resolver`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:288](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L288)

Appends a RIGHT JOIN clause to the query using a SourceExpression.

#### Parameters

##### sourceExpr

`SourceExpression`

The source expression to join

##### columns

The columns to use for the join condition

`string` | `string`[]

##### resolver

`null` | [`TableColumnResolver`](../type-aliases/TableColumnResolver.md)

#### Returns

`void`

***

### toSource()

> **toSource**(`alias`): `SourceExpression`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:371](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L371)

#### Parameters

##### alias

`string`

#### Returns

`SourceExpression`

***

### appendWith()

> **appendWith**(`commonTable`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:381](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L381)

#### Parameters

##### commonTable

`CommonTable` | `CommonTable`[]

#### Returns

`void`

***

### appendWithRaw()

> **appendWithRaw**(`rawText`, `alias`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:400](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L400)

Appends a CommonTable (CTE) to the WITH clause from raw SQL text and alias.
If alias is provided, it will be used as the CTE name.

#### Parameters

##### rawText

`string`

Raw SQL string representing the CTE body (e.g. '(SELECT ...)')

##### alias

`string`

Optional alias for the CTE (e.g. 'cte_name')

#### Returns

`void`

***

### overrideSelectItemExpr()

> **overrideSelectItemExpr**(`columnName`, `fn`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:417](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L417)

Overrides a select item using a template literal function.
The callback receives the SQL string of the original expression and must return a new SQL string.
The result is parsed and set as the new select item value.

Example usage:
  query.overrideSelectItemRaw("journal_date", expr => `greatest(${expr}, DATE '2025-01-01')`)

#### Parameters

##### columnName

`string`

The name of the column to override

##### fn

(`expr`) => `string`

Callback that receives the SQL string of the original expression and returns a new SQL string

#### Returns

`void`

***

### appendWhereExpr()

> **appendWhereExpr**(`columnName`, `exprBuilder`, `options?`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:441](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L441)

Appends a WHERE clause using the expression for the specified column.
If `options.upstream` is true, applies to all upstream queries containing the column.
If false or omitted, applies only to the current query.

#### Parameters

##### columnName

`string`

The name of the column to target.

##### exprBuilder

(`expr`) => `string`

Function that receives the column expression as a string and returns the WHERE condition string.

##### options?

Optional settings. If `upstream` is true, applies to upstream queries.

###### upstream?

`boolean`

#### Returns

`void`

***

### setParameter()

> **setParameter**(`name`, `value`): `this`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:480](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L480)

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

> **toSimpleQuery**(): `SimpleSelectQuery`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:489](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L489)

Returns this SimpleSelectQuery instance (identity function).

#### Returns

`SimpleSelectQuery`

This SimpleSelectQuery instance

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toSimpleQuery`](../interfaces/SelectQuery.md#tosimplequery)

***

### addCTE()

> **addCTE**(`name`, `query`, `options?`): `this`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:524](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L524)

Adds a CTE (Common Table Expression) to the query.

#### Parameters

##### name

`string`

CTE name/alias (must be non-empty)

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

SelectQuery to use as CTE

##### options?

[`CTEOptions`](../interfaces/CTEOptions.md)

Optional configuration

#### Returns

`this`

#### Throws

When name is empty or whitespace-only

#### Throws

When CTE with same name already exists

#### Example

```typescript
// Basic CTE
query.addCTE('active_users', 
  SelectQueryParser.parse('SELECT * FROM users WHERE active = true')
);

// PostgreSQL MATERIALIZED CTE (forces materialization)
query.addCTE('expensive_calc', expensiveQuery, { materialized: true });

// PostgreSQL NOT MATERIALIZED CTE (prevents materialization)
query.addCTE('simple_view', simpleQuery, { materialized: false });
```

#### Remarks

- MATERIALIZED/NOT MATERIALIZED is PostgreSQL-specific syntax
- Other databases will ignore the materialized hint
- CTE names must be unique within the query
- Method supports fluent chaining

#### Implementation of

[`CTEManagement`](../interfaces/CTEManagement.md).[`addCTE`](../interfaces/CTEManagement.md#addcte)

***

### removeCTE()

> **removeCTE**(`name`): `this`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:565](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L565)

Removes a CTE by name from the query.

#### Parameters

##### name

`string`

CTE name to remove

#### Returns

`this`

#### Throws

When CTE with specified name doesn't exist

#### Example

```typescript
query.addCTE('temp_data', tempQuery);
query.removeCTE('temp_data'); // Removes the CTE

// Throws CTENotFoundError
query.removeCTE('non_existent'); 
```

#### Remarks

- Throws error if CTE doesn't exist (strict mode for safety)
- Use hasCTE() to check existence before removal if needed
- Method supports fluent chaining

#### Implementation of

[`CTEManagement`](../interfaces/CTEManagement.md).[`removeCTE`](../interfaces/CTEManagement.md#removecte)

***

### hasCTE()

> **hasCTE**(`name`): `boolean`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:607](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L607)

Checks if a CTE with the given name exists in the query.
Optimized with O(1) lookup using internal cache.

#### Parameters

##### name

`string`

CTE name to check

#### Returns

`boolean`

true if CTE exists, false otherwise

#### Example

```typescript
query.addCTE('user_stats', statsQuery);

if (query.hasCTE('user_stats')) {
  console.log('CTE exists');
}

query.removeCTE('user_stats');
console.log(query.hasCTE('user_stats')); // false
```

#### Remarks

- Performs case-sensitive name matching
- Returns false for queries without any CTEs
- Useful for conditional CTE operations
- O(1) performance using internal cache

#### Implementation of

[`CTEManagement`](../interfaces/CTEManagement.md).[`hasCTE`](../interfaces/CTEManagement.md#hascte)

***

### getCTENames()

> **getCTENames**(): `string`[]

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:642](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L642)

Returns an array of all CTE names in the query.

#### Returns

`string`[]

Array of CTE names in the order they were defined

#### Example

```typescript
const query = SelectQueryParser.parse('SELECT * FROM data').toSimpleQuery();

// Empty query
console.log(query.getCTENames()); // []

// Add CTEs
query.addCTE('users', userQuery);
query.addCTE('orders', orderQuery);

console.log(query.getCTENames()); // ['users', 'orders']

// Use for validation
const expectedCTEs = ['users', 'orders', 'products'];
const actualCTEs = query.getCTENames();
const missingCTEs = expectedCTEs.filter(name => !actualCTEs.includes(name));
```

#### Remarks

- Returns empty array for queries without CTEs
- Names are returned in definition order
- Useful for debugging and validation
- Names reflect actual CTE aliases, not table references
- Performance: O(n) but avoids redundant array mapping

#### Implementation of

[`CTEManagement`](../interfaces/CTEManagement.md).[`getCTENames`](../interfaces/CTEManagement.md#getctenames)

***

### replaceCTE()

> **replaceCTE**(`name`, `query`, `options?`): `this`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:685](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SimpleSelectQuery.ts#L685)

Replaces an existing CTE or adds a new one with the given name.

#### Parameters

##### name

`string`

CTE name to replace/add (must be non-empty)

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

SelectQuery to use as CTE

##### options?

[`CTEOptions`](../interfaces/CTEOptions.md)

Optional configuration

#### Returns

`this`

#### Throws

When name is empty or whitespace-only

#### Example

```typescript
const query = SelectQueryParser.parse('SELECT * FROM final_data').toSimpleQuery();
const oldQuery = SelectQueryParser.parse('SELECT id FROM old_table');
const newQuery = SelectQueryParser.parse('SELECT id, status FROM new_table WHERE active = true');

// Add initial CTE
query.addCTE('data_source', oldQuery);

// Replace with improved version
query.replaceCTE('data_source', newQuery, { materialized: true });

// Safe replacement - adds if doesn't exist
query.replaceCTE('new_cte', newQuery); // Won't throw error

// Chaining replacements
query
  .replaceCTE('cte1', query1, { materialized: false })
  .replaceCTE('cte2', query2, { materialized: true });
```

#### Remarks

- Unlike addCTE(), this method won't throw error if CTE already exists
- Unlike removeCTE(), this method won't throw error if CTE doesn't exist
- Useful for upsert-style CTE operations
- MATERIALIZED/NOT MATERIALIZED is PostgreSQL-specific
- Method supports fluent chaining
- Maintains CTE order when replacing existing CTEs

#### Implementation of

[`CTEManagement`](../interfaces/CTEManagement.md).[`replaceCTE`](../interfaces/CTEManagement.md#replacecte)

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
