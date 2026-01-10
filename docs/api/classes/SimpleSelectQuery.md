<div v-pre>
# Class: SimpleSelectQuery

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:44](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L44)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:65](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L65)

#### Parameters

##### params

###### selectClause

[`SelectClause`](SelectClause.md)

###### fromClause?

`null` \| [`FromClause`](FromClause.md)

###### whereClause?

`null` \| [`WhereClause`](WhereClause.md)

###### groupByClause?

`null` \| [`GroupByClause`](GroupByClause.md)

###### havingClause?

`null` \| [`HavingClause`](HavingClause.md)

###### orderByClause?

`null` \| [`OrderByClause`](OrderByClause.md)

###### windowClause?

`null` \| [`WindowsClause`](WindowsClause.md)

###### limitClause?

`null` \| [`LimitClause`](LimitClause.md)

###### offsetClause?

`null` \| [`OffsetClause`](OffsetClause.md)

###### fetchClause?

`null` \| [`FetchClause`](FetchClause.md)

###### forClause?

`null` \| [`ForClause`](ForClause.md)

###### withClause?

`null` \| [`WithClause`](WithClause.md)

#### Returns

`SimpleSelectQuery`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:46](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L46)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### \_\_selectQueryType

> `readonly` **\_\_selectQueryType**: `"SelectQuery"` = `'SelectQuery'`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:47](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L47)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`__selectQueryType`](../interfaces/SelectQuery.md#__selectquerytype)

***

### headerComments

> **headerComments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:48](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L48)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`headerComments`](../interfaces/SelectQuery.md#headercomments)

***

### withClause

> **withClause**: `null` \| [`WithClause`](WithClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:49](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L49)

***

### selectClause

> **selectClause**: [`SelectClause`](SelectClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:50](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L50)

***

### fromClause

> **fromClause**: `null` \| [`FromClause`](FromClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:51](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L51)

***

### whereClause

> **whereClause**: `null` \| [`WhereClause`](WhereClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:52](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L52)

***

### groupByClause

> **groupByClause**: `null` \| [`GroupByClause`](GroupByClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:53](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L53)

***

### havingClause

> **havingClause**: `null` \| [`HavingClause`](HavingClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:54](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L54)

***

### orderByClause

> **orderByClause**: `null` \| [`OrderByClause`](OrderByClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:55](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L55)

***

### windowClause

> **windowClause**: `null` \| [`WindowsClause`](WindowsClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:56](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L56)

***

### limitClause

> **limitClause**: `null` \| [`LimitClause`](LimitClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:57](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L57)

***

### offsetClause

> **offsetClause**: `null` \| [`OffsetClause`](OffsetClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:58](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L58)

***

### fetchClause

> **fetchClause**: `null` \| [`FetchClause`](FetchClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:59](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L59)

***

### forClause

> **forClause**: `null` \| [`ForClause`](ForClause.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:60](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L60)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SqlComponent.ts#L29)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`comments`](../interfaces/SelectQuery.md#comments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SqlComponent.ts#L32)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`positionedComments`](../interfaces/SelectQuery.md#positionedcomments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Methods

### toUnion()

> **toUnion**(`rightQuery`): [`BinarySelectQuery`](BinarySelectQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:118](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L118)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:129](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L129)

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

### toInsertQuery()

> **toInsertQuery**(`options`): [`InsertQuery`](InsertQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:138](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L138)

Converts this query into an INSERT statement definition.

#### Parameters

##### options

[`InsertQueryConversionOptions`](../interfaces/InsertQueryConversionOptions.md)

#### Returns

[`InsertQuery`](InsertQuery.md)

#### Remarks

Calling this method may reorder the current SELECT clause to match the requested column order.

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toInsertQuery`](../interfaces/SelectQuery.md#toinsertquery)

***

### toUpdateQuery()

> **toUpdateQuery**(`options`): [`UpdateQuery`](UpdateQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:147](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L147)

Converts this query into an UPDATE statement definition.

#### Parameters

##### options

[`UpdateQueryConversionOptions`](../interfaces/UpdateQueryConversionOptions.md)

#### Returns

[`UpdateQuery`](UpdateQuery.md)

#### Remarks

The conversion may reorder the SELECT list so that primary keys and updated columns align with the target table.

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toUpdateQuery`](../interfaces/SelectQuery.md#toupdatequery)

***

### toDeleteQuery()

> **toDeleteQuery**(`options`): [`DeleteQuery`](DeleteQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:156](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L156)

Converts this query into a DELETE statement definition.

#### Parameters

##### options

[`DeleteQueryConversionOptions`](../interfaces/DeleteQueryConversionOptions.md)

#### Returns

[`DeleteQuery`](DeleteQuery.md)

#### Remarks

The SELECT clause may be reordered to ensure primary keys and comparison columns appear first.

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toDeleteQuery`](../interfaces/SelectQuery.md#todeletequery)

***

### toMergeQuery()

> **toMergeQuery**(`options`): [`MergeQuery`](MergeQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:165](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L165)

Converts this query into a MERGE statement definition.

#### Parameters

##### options

[`MergeQueryConversionOptions`](../interfaces/MergeQueryConversionOptions.md)

#### Returns

[`MergeQuery`](MergeQuery.md)

#### Remarks

This method may reorder the SELECT clause to align with the specified MERGE column lists.

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toMergeQuery`](../interfaces/SelectQuery.md#tomergequery)

***

### toIntersect()

> **toIntersect**(`rightQuery`): [`BinarySelectQuery`](BinarySelectQuery.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:176](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L176)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:187](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L187)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:198](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L198)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:209](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L209)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:221](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L221)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:231](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L231)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:242](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L242)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:260](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L260)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:271](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L271)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:289](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L289)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:299](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L299)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:309](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L309)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:318](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L318)

Appends an INNER JOIN clause to the query using a SourceExpression.

#### Parameters

##### sourceExpr

[`SourceExpression`](SourceExpression.md)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:327](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L327)

Appends a LEFT JOIN clause to the query using a SourceExpression.

#### Parameters

##### sourceExpr

[`SourceExpression`](SourceExpression.md)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:336](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L336)

Appends a RIGHT JOIN clause to the query using a SourceExpression.

#### Parameters

##### sourceExpr

[`SourceExpression`](SourceExpression.md)

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

> **toSource**(`alias`): [`SourceExpression`](SourceExpression.md)

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:419](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L419)

#### Parameters

##### alias

`string`

#### Returns

[`SourceExpression`](SourceExpression.md)

***

### appendWith()

> **appendWith**(`commonTable`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:429](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L429)

#### Parameters

##### commonTable

[`CommonTable`](CommonTable.md) | [`CommonTable`](CommonTable.md)[]

#### Returns

`void`

***

### appendWithRaw()

> **appendWithRaw**(`rawText`, `alias`): `void`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:448](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L448)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:465](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L465)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:489](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L489)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:528](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L528)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:537](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L537)

Returns this SimpleSelectQuery instance (identity function).

#### Returns

`SimpleSelectQuery`

This SimpleSelectQuery instance

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toSimpleQuery`](../interfaces/SelectQuery.md#tosimplequery)

***

### addCTE()

> **addCTE**(`name`, `query`, `options?`): `this`

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:572](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L572)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:613](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L613)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:655](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L655)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:690](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L690)

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

Defined in: [packages/core/src/models/SimpleSelectQuery.ts:733](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SimpleSelectQuery.ts#L733)

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

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`getKind`](../interfaces/SelectQuery.md#getkind)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`getAllPositionedComments`](../interfaces/SelectQuery.md#getallpositionedcomments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
