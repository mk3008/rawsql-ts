<div v-pre>
# Class: MergeQuery

Defined in: [packages/core/src/models/MergeQuery.ts:119](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/MergeQuery.ts#L119)

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new MergeQuery**(`params`): `MergeQuery`

Defined in: [packages/core/src/models/MergeQuery.ts:127](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/MergeQuery.ts#L127)

#### Parameters

##### params

###### withClause?

`null` \| [`WithClause`](WithClause.md)

###### target

[`SourceExpression`](SourceExpression.md)

###### source

[`SourceExpression`](SourceExpression.md)

###### onCondition

[`ValueComponent`](../type-aliases/ValueComponent.md)

###### whenClauses

[`MergeWhenClause`](MergeWhenClause.md)[]

#### Returns

`MergeQuery`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/MergeQuery.ts:120](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/MergeQuery.ts#L120)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### withClause

> **withClause**: `null` \| [`WithClause`](WithClause.md)

Defined in: [packages/core/src/models/MergeQuery.ts:121](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/MergeQuery.ts#L121)

***

### target

> **target**: [`SourceExpression`](SourceExpression.md)

Defined in: [packages/core/src/models/MergeQuery.ts:122](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/MergeQuery.ts#L122)

***

### source

> **source**: [`SourceExpression`](SourceExpression.md)

Defined in: [packages/core/src/models/MergeQuery.ts:123](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/MergeQuery.ts#L123)

***

### onCondition

> **onCondition**: [`ValueComponent`](../type-aliases/ValueComponent.md)

Defined in: [packages/core/src/models/MergeQuery.ts:124](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/MergeQuery.ts#L124)

***

### whenClauses

> **whenClauses**: [`MergeWhenClause`](MergeWhenClause.md)[]

Defined in: [packages/core/src/models/MergeQuery.ts:125](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/MergeQuery.ts#L125)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
