<div v-pre>
# Abstract Class: SqlComponent

Defined in: [packages/core/src/models/SqlComponent.ts:9](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L9)

## Extended by

- [`BinarySelectQuery`](BinarySelectQuery.md)
- [`SelectQuery`](../interfaces/SelectQuery.md)
- [`InlineQuery`](InlineQuery.md)
- [`ValueList`](ValueList.md)
- [`ColumnReference`](ColumnReference.md)
- [`FunctionCall`](FunctionCall.md)
- [`WindowFrameBoundStatic`](WindowFrameBoundStatic.md)
- [`WindowFrameBoundaryValue`](WindowFrameBoundaryValue.md)
- [`WindowFrameSpec`](WindowFrameSpec.md)
- [`WindowFrameExpression`](WindowFrameExpression.md)
- [`UnaryExpression`](UnaryExpression.md)
- [`BinaryExpression`](BinaryExpression.md)
- [`LiteralValue`](LiteralValue.md)
- [`ParameterExpression`](ParameterExpression.md)
- [`SwitchCaseArgument`](SwitchCaseArgument.md)
- [`CaseKeyValuePair`](CaseKeyValuePair.md)
- [`RawString`](RawString.md)
- [`IdentifierString`](IdentifierString.md)
- [`ParenExpression`](ParenExpression.md)
- [`CastExpression`](CastExpression.md)
- [`CaseExpression`](CaseExpression.md)
- [`ArrayExpression`](ArrayExpression.md)
- [`ArrayQueryExpression`](ArrayQueryExpression.md)
- [`BetweenExpression`](BetweenExpression.md)
- [`StringSpecifierExpression`](StringSpecifierExpression.md)
- [`TypeValue`](TypeValue.md)
- [`TupleExpression`](TupleExpression.md)
- [`ArraySliceExpression`](ArraySliceExpression.md)
- [`ArrayIndexExpression`](ArrayIndexExpression.md)
- [`QualifiedName`](QualifiedName.md)
- [`SimpleSelectQuery`](SimpleSelectQuery.md)
- [`ValuesQuery`](ValuesQuery.md)
- [`InsertQuery`](InsertQuery.md)

## Constructors

### Constructor

> **new SqlComponent**(): `SqlComponent`

#### Returns

`SqlComponent`

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:11](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L11)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:27](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L27)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:30](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L30)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:13](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L13)

#### Returns

`symbol`

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

***

### toSqlString()

> **toSqlString**(`formatter`): `string`

Defined in: [packages/core/src/models/SqlComponent.ts:21](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L21)

#### Parameters

##### formatter

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`string`\&gt;

#### Returns

`string`

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

***

### getAllPositionedComments()

> **getAllPositionedComments**(): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:64](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L64)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]
</div>
