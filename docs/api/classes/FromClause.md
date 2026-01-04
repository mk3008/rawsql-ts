<div v-pre>
# Class: FromClause

Defined in: [packages/core/src/models/Clause.ts:309](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/Clause.ts#L309)

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new FromClause**(`source`, `join`): `FromClause`

Defined in: [packages/core/src/models/Clause.ts:313](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/Clause.ts#L313)

#### Parameters

##### source

[`SourceExpression`](SourceExpression.md)

##### join

`null` | [`JoinClause`](JoinClause.md)[]

#### Returns

`FromClause`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/Clause.ts:310](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/Clause.ts#L310)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### source

> **source**: [`SourceExpression`](SourceExpression.md)

Defined in: [packages/core/src/models/Clause.ts:311](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/Clause.ts#L311)

***

### joins

> **joins**: `null` \| [`JoinClause`](JoinClause.md)[]

Defined in: [packages/core/src/models/Clause.ts:312](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/Clause.ts#L312)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Methods

### getSourceAliasName()

> **getSourceAliasName**(): `null` \| `string`

Defined in: [packages/core/src/models/Clause.ts:318](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/Clause.ts#L318)

#### Returns

`null` \| `string`

***

### getSources()

> **getSources**(): [`SourceExpression`](SourceExpression.md)[]

Defined in: [packages/core/src/models/Clause.ts:330](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/Clause.ts#L330)

Returns all SourceExpression objects in this FROM clause, including main source and all JOIN sources.

#### Returns

[`SourceExpression`](SourceExpression.md)[]

***

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
