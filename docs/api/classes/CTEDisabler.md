<div v-pre>
# Class: CTEDisabler

Defined in: [packages/core/src/transformers/CTEDisabler.ts:28](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L28)

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

Defined in: [packages/core/src/transformers/CTEDisabler.ts:33](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L33)

#### Returns

`CTEDisabler`

## Methods

### execute()

> **execute**(`arg`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:117](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L117)

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

***

### visit()

> **visit**(`arg`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:127](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L127)

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

Defined in: [packages/core/src/transformers/CTEDisabler.ts:169](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L169)

#### Parameters

##### arg

[`SimpleSelectQuery`](SimpleSelectQuery.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitBinarySelectQuery()

> **visitBinarySelectQuery**(`query`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:193](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L193)

#### Parameters

##### query

[`BinarySelectQuery`](BinarySelectQuery.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitValuesQuery()

> **visitValuesQuery**(`query`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:199](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L199)

#### Parameters

##### query

[`ValuesQuery`](ValuesQuery.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitInsertQuery()

> **visitInsertQuery**(`query`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:204](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L204)

#### Parameters

##### query

[`InsertQuery`](InsertQuery.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitUpdateQuery()

> **visitUpdateQuery**(`query`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:209](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L209)

#### Parameters

##### query

[`UpdateQuery`](UpdateQuery.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitDeleteQuery()

> **visitDeleteQuery**(`query`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:214](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L214)

#### Parameters

##### query

[`DeleteQuery`](DeleteQuery.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitSelectClause()

> **visitSelectClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:219](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L219)

#### Parameters

##### clause

[`SelectClause`](SelectClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitFromClause()

> **visitFromClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:230](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L230)

#### Parameters

##### clause

[`FromClause`](FromClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitSubQuerySource()

> **visitSubQuerySource**(`subQuery`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:237](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L237)

#### Parameters

##### subQuery

[`SubQuerySource`](SubQuerySource.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitInlineQuery()

> **visitInlineQuery**(`inlineQuery`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:242](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L242)

#### Parameters

##### inlineQuery

[`InlineQuery`](InlineQuery.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitJoinClause()

> **visitJoinClause**(`joinClause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:247](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L247)

#### Parameters

##### joinClause

[`JoinClause`](JoinClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitJoinOnClause()

> **visitJoinOnClause**(`joinOn`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:259](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L259)

#### Parameters

##### joinOn

[`JoinOnClause`](JoinOnClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitJoinUsingClause()

> **visitJoinUsingClause**(`joinUsing`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:264](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L264)

#### Parameters

##### joinUsing

[`JoinUsingClause`](JoinUsingClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitWhereClause()

> **visitWhereClause**(`whereClause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:269](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L269)

#### Parameters

##### whereClause

[`WhereClause`](WhereClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitGroupByClause()

> **visitGroupByClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:274](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L274)

#### Parameters

##### clause

[`GroupByClause`](GroupByClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitHavingClause()

> **visitHavingClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:279](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L279)

#### Parameters

##### clause

[`HavingClause`](HavingClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitOrderByClause()

> **visitOrderByClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:284](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L284)

#### Parameters

##### clause

[`OrderByClause`](OrderByClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitWindowFrameClause()

> **visitWindowFrameClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:289](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L289)

#### Parameters

##### clause

[`WindowFrameClause`](WindowFrameClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitLimitClause()

> **visitLimitClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:294](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L294)

#### Parameters

##### clause

[`LimitClause`](LimitClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitForClause()

> **visitForClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:299](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L299)

#### Parameters

##### clause

[`ForClause`](ForClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitParenExpression()

> **visitParenExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:303](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L303)

#### Parameters

##### expr

[`ParenExpression`](ParenExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitBinaryExpression()

> **visitBinaryExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:308](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L308)

#### Parameters

##### expr

[`BinaryExpression`](BinaryExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitUnaryExpression()

> **visitUnaryExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:314](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L314)

#### Parameters

##### expr

[`UnaryExpression`](UnaryExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitCaseExpression()

> **visitCaseExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:319](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L319)

#### Parameters

##### expr

[`CaseExpression`](CaseExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitSwitchCaseArgument()

> **visitSwitchCaseArgument**(`switchCase`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:325](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L325)

#### Parameters

##### switchCase

[`SwitchCaseArgument`](SwitchCaseArgument.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitCaseKeyValuePair()

> **visitCaseKeyValuePair**(`pair`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:331](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L331)

#### Parameters

##### pair

[`CaseKeyValuePair`](CaseKeyValuePair.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitBetweenExpression()

> **visitBetweenExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:337](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L337)

#### Parameters

##### expr

[`BetweenExpression`](BetweenExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitFunctionCall()

> **visitFunctionCall**(`func`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:344](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L344)

#### Parameters

##### func

[`FunctionCall`](FunctionCall.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitArrayExpression()

> **visitArrayExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:350](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L350)

#### Parameters

##### expr

[`ArrayExpression`](ArrayExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitArrayQueryExpression()

> **visitArrayQueryExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:355](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L355)

#### Parameters

##### expr

[`ArrayQueryExpression`](ArrayQueryExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitTupleExpression()

> **visitTupleExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:360](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L360)

#### Parameters

##### expr

[`TupleExpression`](TupleExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitCastExpression()

> **visitCastExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:365](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L365)

#### Parameters

##### expr

[`CastExpression`](CastExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitTypeValue()

> **visitTypeValue**(`typeValue`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:371](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L371)

#### Parameters

##### typeValue

[`TypeValue`](TypeValue.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitSelectItem()

> **visitSelectItem**(`item`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:376](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L376)

#### Parameters

##### item

[`SelectItem`](SelectItem.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitIdentifierString()

> **visitIdentifierString**(`ident`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:381](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L381)

#### Parameters

##### ident

[`IdentifierString`](IdentifierString.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitRawString()

> **visitRawString**(`raw`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:386](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L386)

#### Parameters

##### raw

[`RawString`](RawString.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitColumnReference()

> **visitColumnReference**(`column`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:391](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L391)

#### Parameters

##### column

[`ColumnReference`](ColumnReference.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitSourceExpression()

> **visitSourceExpression**(`source`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:396](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L396)

#### Parameters

##### source

[`SourceExpression`](SourceExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitTableSource()

> **visitTableSource**(`source`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:403](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L403)

#### Parameters

##### source

[`TableSource`](TableSource.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitParenSource()

> **visitParenSource**(`source`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:408](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L408)

#### Parameters

##### source

[`ParenSource`](ParenSource.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitParameterExpression()

> **visitParameterExpression**(`param`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:413](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L413)

#### Parameters

##### param

[`ParameterExpression`](ParameterExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitWindowFrameExpression()

> **visitWindowFrameExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:418](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L418)

#### Parameters

##### expr

[`WindowFrameExpression`](WindowFrameExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitWindowFrameSpec()

> **visitWindowFrameSpec**(`spec`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:430](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L430)

#### Parameters

##### spec

[`WindowFrameSpec`](WindowFrameSpec.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitLiteralValue()

> **visitLiteralValue**(`value`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:435](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L435)

#### Parameters

##### value

[`ValueComponent`](../type-aliases/ValueComponent.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitOrderByItem()

> **visitOrderByItem**(`item`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:440](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L440)

#### Parameters

##### item

[`OrderByItem`](OrderByItem.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitValueList()

> **visitValueList**(`valueList`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:445](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L445)

#### Parameters

##### valueList

[`ValueList`](ValueList.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitArraySliceExpression()

> **visitArraySliceExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:450](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L450)

#### Parameters

##### expr

[`ArraySliceExpression`](ArraySliceExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitArrayIndexExpression()

> **visitArrayIndexExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:454](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L454)

#### Parameters

##### expr

[`ArrayIndexExpression`](ArrayIndexExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitStringSpecifierExpression()

> **visitStringSpecifierExpression**(`expr`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:458](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L458)

#### Parameters

##### expr

[`StringSpecifierExpression`](StringSpecifierExpression.md)

#### Returns

[`SqlComponent`](SqlComponent.md)

***

### visitPartitionByClause()

> **visitPartitionByClause**(`clause`): [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/CTEDisabler.ts:462](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/CTEDisabler.ts#L462)

#### Parameters

##### clause

[`PartitionByClause`](PartitionByClause.md)

#### Returns

[`SqlComponent`](SqlComponent.md)
</div>
