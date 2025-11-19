<div v-pre>
# Class: CTEDisabler

Defined in: [packages/core/src/transformers/CTEDisabler.ts:25](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L25)

A visitor that disables all WITH clauses in a SQL query structure.
This processes and removes WITH clauses from:
- Simple SELECT queries
- Binary queries (UNION, EXCEPT, etc.)
- Subqueries
- Inline queries

It maintains the CTE queries themselves but restructures the query to not use
the WITH clause syntactical construct.

## Implements

- [`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;[`SqlComponent`](SqlComponent.md)\&gt;

## Constructors

### Constructor

> **new CTEDisabler**(): `CTEDisabler`

Defined in: [packages/core/src/transformers/CTEDisabler.ts:30](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L30)

#### Returns

`CTEDisabler`

## Methods

### execute()

> **execute**(`arg`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:109](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L109)

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

***

### visit()

> **visit**(`arg`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:119](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L119)

Main entry point for the visitor pattern.
Implements the shallow visit pattern to distinguish between root and recursive visits.

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

#### Implementation of

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md).[`visit`](../interfaces/SqlComponentVisitor.md#visit)

***

### visitSimpleSelectQuery()

> **visitSimpleSelectQuery**(`arg`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:161](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L161)

#### Parameters

##### arg

[`SimpleSelectQuery`](SimpleSelectQuery.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitBinarySelectQuery()

> **visitBinarySelectQuery**(`query`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:185](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L185)

#### Parameters

##### query

[`BinarySelectQuery`](BinarySelectQuery.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitValuesQuery()

> **visitValuesQuery**(`query`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:191](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L191)

#### Parameters

##### query

[`ValuesQuery`](ValuesQuery.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitSelectClause()

> **visitSelectClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:196](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L196)

#### Parameters

##### clause

`SelectClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitFromClause()

> **visitFromClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:207](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L207)

#### Parameters

##### clause

`FromClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitSubQuerySource()

> **visitSubQuerySource**(`subQuery`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:214](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L214)

#### Parameters

##### subQuery

`SubQuerySource`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitInlineQuery()

> **visitInlineQuery**(`inlineQuery`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:219](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L219)

#### Parameters

##### inlineQuery

[`InlineQuery`](InlineQuery.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitJoinClause()

> **visitJoinClause**(`joinClause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:224](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L224)

#### Parameters

##### joinClause

`JoinClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitJoinOnClause()

> **visitJoinOnClause**(`joinOn`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:236](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L236)

#### Parameters

##### joinOn

`JoinOnClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitJoinUsingClause()

> **visitJoinUsingClause**(`joinUsing`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:241](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L241)

#### Parameters

##### joinUsing

`JoinUsingClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitWhereClause()

> **visitWhereClause**(`whereClause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:246](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L246)

#### Parameters

##### whereClause

`WhereClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitGroupByClause()

> **visitGroupByClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:251](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L251)

#### Parameters

##### clause

`GroupByClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitHavingClause()

> **visitHavingClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:256](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L256)

#### Parameters

##### clause

`HavingClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitOrderByClause()

> **visitOrderByClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:261](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L261)

#### Parameters

##### clause

`OrderByClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitWindowFrameClause()

> **visitWindowFrameClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:266](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L266)

#### Parameters

##### clause

`WindowFrameClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitLimitClause()

> **visitLimitClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:271](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L271)

#### Parameters

##### clause

`LimitClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitForClause()

> **visitForClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:276](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L276)

#### Parameters

##### clause

`ForClause`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitParenExpression()

> **visitParenExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:280](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L280)

#### Parameters

##### expr

[`ParenExpression`](ParenExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitBinaryExpression()

> **visitBinaryExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:285](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L285)

#### Parameters

##### expr

[`BinaryExpression`](BinaryExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitUnaryExpression()

> **visitUnaryExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:291](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L291)

#### Parameters

##### expr

[`UnaryExpression`](UnaryExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitCaseExpression()

> **visitCaseExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:296](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L296)

#### Parameters

##### expr

[`CaseExpression`](CaseExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitSwitchCaseArgument()

> **visitSwitchCaseArgument**(`switchCase`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:302](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L302)

#### Parameters

##### switchCase

[`SwitchCaseArgument`](SwitchCaseArgument.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitCaseKeyValuePair()

> **visitCaseKeyValuePair**(`pair`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:308](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L308)

#### Parameters

##### pair

[`CaseKeyValuePair`](CaseKeyValuePair.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitBetweenExpression()

> **visitBetweenExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:314](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L314)

#### Parameters

##### expr

[`BetweenExpression`](BetweenExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitFunctionCall()

> **visitFunctionCall**(`func`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:321](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L321)

#### Parameters

##### func

[`FunctionCall`](FunctionCall.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitArrayExpression()

> **visitArrayExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:327](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L327)

#### Parameters

##### expr

[`ArrayExpression`](ArrayExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitArrayQueryExpression()

> **visitArrayQueryExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:332](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L332)

#### Parameters

##### expr

[`ArrayQueryExpression`](ArrayQueryExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitTupleExpression()

> **visitTupleExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:337](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L337)

#### Parameters

##### expr

[`TupleExpression`](TupleExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitCastExpression()

> **visitCastExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:342](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L342)

#### Parameters

##### expr

[`CastExpression`](CastExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitTypeValue()

> **visitTypeValue**(`typeValue`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:348](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L348)

#### Parameters

##### typeValue

[`TypeValue`](TypeValue.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitSelectItem()

> **visitSelectItem**(`item`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:353](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L353)

#### Parameters

##### item

`SelectItem`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitIdentifierString()

> **visitIdentifierString**(`ident`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:358](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L358)

#### Parameters

##### ident

[`IdentifierString`](IdentifierString.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitRawString()

> **visitRawString**(`raw`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:363](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L363)

#### Parameters

##### raw

[`RawString`](RawString.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitColumnReference()

> **visitColumnReference**(`column`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:368](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L368)

#### Parameters

##### column

[`ColumnReference`](ColumnReference.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitSourceExpression()

> **visitSourceExpression**(`source`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:373](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L373)

#### Parameters

##### source

`SourceExpression`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitTableSource()

> **visitTableSource**(`source`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:380](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L380)

#### Parameters

##### source

`TableSource`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitParenSource()

> **visitParenSource**(`source`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:385](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L385)

#### Parameters

##### source

`ParenSource`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitParameterExpression()

> **visitParameterExpression**(`param`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:390](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L390)

#### Parameters

##### param

[`ParameterExpression`](ParameterExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitWindowFrameExpression()

> **visitWindowFrameExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:395](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L395)

#### Parameters

##### expr

[`WindowFrameExpression`](WindowFrameExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitWindowFrameSpec()

> **visitWindowFrameSpec**(`spec`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:407](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L407)

#### Parameters

##### spec

[`WindowFrameSpec`](WindowFrameSpec.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitLiteralValue()

> **visitLiteralValue**(`value`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:412](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L412)

#### Parameters

##### value

[`ValueComponent`](../type-aliases/ValueComponent.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitOrderByItem()

> **visitOrderByItem**(`item`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:417](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L417)

#### Parameters

##### item

`OrderByItem`

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitValueList()

> **visitValueList**(`valueList`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:422](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L422)

#### Parameters

##### valueList

[`ValueList`](ValueList.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitArraySliceExpression()

> **visitArraySliceExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:427](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L427)

#### Parameters

##### expr

[`ArraySliceExpression`](ArraySliceExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitArrayIndexExpression()

> **visitArrayIndexExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:431](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L431)

#### Parameters

##### expr

[`ArrayIndexExpression`](ArrayIndexExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitStringSpecifierExpression()

> **visitStringSpecifierExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:435](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L435)

#### Parameters

##### expr

[`StringSpecifierExpression`](StringSpecifierExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitPartitionByClause()

> **visitPartitionByClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:439](https://github.com/mk3008/rawsql-ts/blob/bca39f409b31840a186a150beab840c26a0a1a87/packages/core/src/transformers/CTEDisabler.ts#L439)

#### Parameters

##### clause

`PartitionByClause`

#### Returns

[`SqlComponent`](SqlComponent.md)
</div>
