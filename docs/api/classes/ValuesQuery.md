<div v-pre>
# Class: ValuesQuery

Defined in: [packages/core/src/models/ValuesQuery.ts:23](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L23)

Represents a VALUES query in SQL.

## Extends

- [`SqlComponent`](SqlComponent.md)

## Implements

- [`SelectQuery`](../interfaces/SelectQuery.md)

## Constructors

### Constructor

> **new ValuesQuery**(`tuples`, `columnAliases`): `ValuesQuery`

Defined in: [packages/core/src/models/ValuesQuery.ts:36](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L36)

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

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L29)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`comments`](../interfaces/SelectQuery.md#comments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L32)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`positionedComments`](../interfaces/SelectQuery.md#positionedcomments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

***

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/ValuesQuery.ts:24](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L24)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### \_\_selectQueryType

> `readonly` **\_\_selectQueryType**: `"SelectQuery"` = `'SelectQuery'`

Defined in: [packages/core/src/models/ValuesQuery.ts:25](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L25)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`__selectQueryType`](../interfaces/SelectQuery.md#__selectquerytype)

***

### headerComments

> **headerComments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/ValuesQuery.ts:26](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L26)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`headerComments`](../interfaces/SelectQuery.md#headercomments)

***

### withClause

> **withClause**: `null` \| [`WithClause`](WithClause.md) = `null`

Defined in: [packages/core/src/models/ValuesQuery.ts:27](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L27)

***

### tuples

> **tuples**: [`TupleExpression`](TupleExpression.md)[]

Defined in: [packages/core/src/models/ValuesQuery.ts:28](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L28)

***

### columnAliases

> **columnAliases**: `null` \| `string`[]

Defined in: [packages/core/src/models/ValuesQuery.ts:34](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L34)

Column aliases for the VALUES query.
These represent the logical column names for each value tuple.
Note: This property is optional and is not referenced during SQL output, but is used when converting to a SimpleSelectQuery.

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`getKind`](../interfaces/SelectQuery.md#getkind)

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

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`accept`](../interfaces/SelectQuery.md#accept)

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

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toSqlString`](../interfaces/SelectQuery.md#tosqlstring)

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

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`addPositionedComments`](../interfaces/SelectQuery.md#addpositionedcomments)

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

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`getPositionedComments`](../interfaces/SelectQuery.md#getpositionedcomments)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getPositionedComments`](SqlComponent.md#getpositionedcomments)

***

### getAllPositionedComments()

> **getAllPositionedComments**(): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/SqlComponent.ts#L66)

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

Defined in: [packages/core/src/models/ValuesQuery.ts:42](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L42)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toSimpleQuery`](../interfaces/SelectQuery.md#tosimplequery)

***

### toInsertQuery()

> **toInsertQuery**(`options`): [`InsertQuery`](InsertQuery.md)

Defined in: [packages/core/src/models/ValuesQuery.ts:50](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L50)

Converts this VALUES query into an INSERT statement definition.

#### Parameters

##### options

[`InsertQueryConversionOptions`](../interfaces/InsertQueryConversionOptions.md)

#### Returns

[`InsertQuery`](InsertQuery.md)

#### Remarks

The conversion may reorder the generated SELECT clause to align with the requested column order.

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toInsertQuery`](../interfaces/SelectQuery.md#toinsertquery)

***

### toUpdateQuery()

> **toUpdateQuery**(`options`): [`UpdateQuery`](UpdateQuery.md)

Defined in: [packages/core/src/models/ValuesQuery.ts:58](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L58)

Converts this VALUES query into an UPDATE statement definition.

#### Parameters

##### options

[`UpdateQueryConversionOptions`](../interfaces/UpdateQueryConversionOptions.md)

#### Returns

[`UpdateQuery`](UpdateQuery.md)

#### Remarks

The conversion may reorder the generated SELECT clause to align with the requested column order.

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toUpdateQuery`](../interfaces/SelectQuery.md#toupdatequery)

***

### toDeleteQuery()

> **toDeleteQuery**(`options`): [`DeleteQuery`](DeleteQuery.md)

Defined in: [packages/core/src/models/ValuesQuery.ts:66](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L66)

Converts this VALUES query into a DELETE statement definition.

#### Parameters

##### options

[`DeleteQueryConversionOptions`](../interfaces/DeleteQueryConversionOptions.md)

#### Returns

[`DeleteQuery`](DeleteQuery.md)

#### Remarks

The conversion may reorder the generated SELECT clause to align with the requested column order.

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toDeleteQuery`](../interfaces/SelectQuery.md#todeletequery)

***

### toMergeQuery()

> **toMergeQuery**(`options`): [`MergeQuery`](MergeQuery.md)

Defined in: [packages/core/src/models/ValuesQuery.ts:74](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L74)

Converts this VALUES query into a MERGE statement definition.

#### Parameters

##### options

[`MergeQueryConversionOptions`](../interfaces/MergeQueryConversionOptions.md)

#### Returns

[`MergeQuery`](MergeQuery.md)

#### Remarks

The conversion may reorder the generated SELECT clause to align with the requested column order.

#### Implementation of

[`SelectQuery`](../interfaces/SelectQuery.md).[`toMergeQuery`](../interfaces/SelectQuery.md#tomergequery)

***

### setParameter()

> **setParameter**(`name`, `value`): `this`

Defined in: [packages/core/src/models/ValuesQuery.ts:83](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/models/ValuesQuery.ts#L83)

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
