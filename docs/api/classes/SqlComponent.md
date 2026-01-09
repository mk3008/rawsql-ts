<div v-pre>
# Abstract Class: SqlComponent

Defined in: [packages/core/src/models/SqlComponent.ts:11](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/models/SqlComponent.ts#L11)

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
- [`SelectItem`](SelectItem.md)
- [`SelectClause`](SelectClause.md)
- [`Distinct`](Distinct.md)
- [`DistinctOn`](DistinctOn.md)
- [`WhereClause`](WhereClause.md)
- [`PartitionByClause`](PartitionByClause.md)
- [`WindowFrameClause`](WindowFrameClause.md)
- [`WindowsClause`](WindowsClause.md)
- [`OrderByClause`](OrderByClause.md)
- [`OrderByItem`](OrderByItem.md)
- [`GroupByClause`](GroupByClause.md)
- [`HavingClause`](HavingClause.md)
- [`TableSource`](TableSource.md)
- [`FunctionSource`](FunctionSource.md)
- [`ParenSource`](ParenSource.md)
- [`SubQuerySource`](SubQuerySource.md)
- [`SourceExpression`](SourceExpression.md)
- [`JoinOnClause`](JoinOnClause.md)
- [`JoinUsingClause`](JoinUsingClause.md)
- [`JoinClause`](JoinClause.md)
- [`FromClause`](FromClause.md)
- [`UsingClause`](UsingClause.md)
- [`CommonTable`](CommonTable.md)
- [`WithClause`](WithClause.md)
- [`LimitClause`](LimitClause.md)
- [`OffsetClause`](OffsetClause.md)
- [`FetchClause`](FetchClause.md)
- [`FetchExpression`](FetchExpression.md)
- [`ForClause`](ForClause.md)
- [`SourceAliasExpression`](SourceAliasExpression.md)
- [`ReturningClause`](ReturningClause.md)
- [`SetClause`](SetClause.md)
- [`SetClauseItem`](SetClauseItem.md)
- [`UpdateClause`](UpdateClause.md)
- [`DeleteClause`](DeleteClause.md)
- [`InsertClause`](InsertClause.md)
- [`ReferenceDefinition`](ReferenceDefinition.md)
- [`ColumnConstraintDefinition`](ColumnConstraintDefinition.md)
- [`TableConstraintDefinition`](TableConstraintDefinition.md)
- [`TableColumnDefinition`](TableColumnDefinition.md)
- [`CreateTableQuery`](CreateTableQuery.md)
- [`MergeAction`](MergeAction.md)
- [`MergeWhenClause`](MergeWhenClause.md)
- [`DropTableStatement`](DropTableStatement.md)
- [`DropIndexStatement`](DropIndexStatement.md)
- [`CreateSchemaStatement`](CreateSchemaStatement.md)
- [`DropSchemaStatement`](DropSchemaStatement.md)
- [`IndexColumnDefinition`](IndexColumnDefinition.md)
- [`CreateIndexStatement`](CreateIndexStatement.md)
- [`AlterTableAddConstraint`](AlterTableAddConstraint.md)
- [`AlterTableDropConstraint`](AlterTableDropConstraint.md)
- [`AlterTableDropColumn`](AlterTableDropColumn.md)
- [`AlterTableAddColumn`](AlterTableAddColumn.md)
- [`AlterTableAlterColumnDefault`](AlterTableAlterColumnDefault.md)
- [`AlterTableStatement`](AlterTableStatement.md)
- [`DropConstraintStatement`](DropConstraintStatement.md)
- [`ExplainOption`](ExplainOption.md)
- [`ExplainStatement`](ExplainStatement.md)
- [`AnalyzeStatement`](AnalyzeStatement.md)
- [`CreateSequenceStatement`](CreateSequenceStatement.md)
- [`AlterSequenceStatement`](AlterSequenceStatement.md)
- [`VacuumStatement`](VacuumStatement.md)
- [`ReindexStatement`](ReindexStatement.md)
- [`ClusterStatement`](ClusterStatement.md)
- [`CheckpointStatement`](CheckpointStatement.md)
- [`SimpleSelectQuery`](SimpleSelectQuery.md)
- [`ValuesQuery`](ValuesQuery.md)
- [`InsertQuery`](InsertQuery.md)
- [`UpdateQuery`](UpdateQuery.md)
- [`DeleteQuery`](DeleteQuery.md)
- [`MergeQuery`](MergeQuery.md)

## Constructors

### Constructor

> **new SqlComponent**(): `SqlComponent`

#### Returns

`SqlComponent`

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:13](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/models/SqlComponent.ts#L13)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/models/SqlComponent.ts#L29)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/models/SqlComponent.ts#L32)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/models/SqlComponent.ts#L23)

#### Parameters

##### formatter

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`string`\&gt;

#### Returns

`string`

***

### addPositionedComments()

> **addPositionedComments**(`position`, `comments`): `void`

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/models/SqlComponent.ts#L56)

Get comments for a specific position

#### Parameters

##### position

`"before"` | `"after"`

#### Returns

`string`[]

***

### getAllPositionedComments()

> **getAllPositionedComments**(): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]
</div>
