<div v-pre>
# Class: JoinClause

Defined in: [packages/core/src/models/Clause.ts:292](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L292)

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new JoinClause**(`joinType`, `source`, `condition`, `lateral`): `JoinClause`

Defined in: [packages/core/src/models/Clause.ts:298](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L298)

#### Parameters

##### joinType

`string`

##### source

[`SourceExpression`](SourceExpression.md)

##### condition

`null` | [`JoinConditionComponent`](../type-aliases/JoinConditionComponent.md)

##### lateral

`boolean`

#### Returns

`JoinClause`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/Clause.ts:293](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L293)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### joinType

> **joinType**: [`RawString`](RawString.md)

Defined in: [packages/core/src/models/Clause.ts:294](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L294)

***

### source

> **source**: [`SourceExpression`](SourceExpression.md)

Defined in: [packages/core/src/models/Clause.ts:295](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L295)

***

### condition

> **condition**: `null` \| [`JoinConditionComponent`](../type-aliases/JoinConditionComponent.md)

Defined in: [packages/core/src/models/Clause.ts:296](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L296)

***

### lateral

> **lateral**: `boolean`

Defined in: [packages/core/src/models/Clause.ts:297](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L297)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Methods

### getSourceAliasName()

> **getSourceAliasName**(): `null` \| `string`

Defined in: [packages/core/src/models/Clause.ts:305](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L305)

#### Returns

`null` \| `string`

***

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/SqlComponent.ts#L19)

#### Type Parameters

##### T

`T`

#### Parameters

##### visitor

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`T`\&gt;

#### Returns

`T`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`accept`](SqlComponent.md#accept)

***

### toSqlString()

> **toSqlString**(`formatter`): `string`

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/SqlComponent.ts#L23)

#### Parameters

##### formatter

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`string`\&gt;

#### Returns

`string`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`toSqlString`](SqlComponent.md#tosqlstring)

***

### addPositionedComments()

> **addPositionedComments**(`position`, `comments`): `void`

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/SqlComponent.ts#L37)

Add comments at a specific position

#### Parameters

##### position

`"before"` | `"after"`

##### comments

`string`[]

#### Returns

`void`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`addPositionedComments`](SqlComponent.md#addpositionedcomments)

***

### getPositionedComments()

> **getPositionedComments**(`position`): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/SqlComponent.ts#L56)

Get comments for a specific position

#### Parameters

##### position

`"before"` | `"after"`

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getPositionedComments`](SqlComponent.md#getpositionedcomments)

***

### getAllPositionedComments()

> **getAllPositionedComments**(): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
