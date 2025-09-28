<div v-pre>
# Interface: SelectQuery

Defined in: [packages/core/src/models/SelectQuery.ts:51](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SelectQuery.ts#L51)

Shared interface implemented by all select query variants.

## Example

```typescript
const query = SelectQueryParser.parse('WITH active_users AS (SELECT * FROM users)');
query.setParameter('tenantId', 42);
const simple = query.toSimpleQuery();
```
Related tests: packages/core/tests/models/SelectQuery.toSimpleQuery.test.ts

## Extends

- [`SqlComponent`](../classes/SqlComponent.md)

## Properties

### \_\_selectQueryType

> `readonly` **\_\_selectQueryType**: `"SelectQuery"`

Defined in: [packages/core/src/models/SelectQuery.ts:52](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SelectQuery.ts#L52)

***

### headerComments

> **headerComments**: `null` \| `string`[]

Defined in: [packages/core/src/models/SelectQuery.ts:53](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SelectQuery.ts#L53)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:27](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L27)

#### Inherited from

[`InsertQuery`](../classes/InsertQuery.md).[`comments`](../classes/InsertQuery.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:30](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L30)

#### Inherited from

[`InsertQuery`](../classes/InsertQuery.md).[`positionedComments`](../classes/InsertQuery.md#positionedcomments)

## Methods

### setParameter()

> **setParameter**(`name`, `value`): `this`

Defined in: [packages/core/src/models/SelectQuery.ts:54](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SelectQuery.ts#L54)

#### Parameters

##### name

`string`

##### value

[`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

#### Returns

`this`

***

### toSimpleQuery()

> **toSimpleQuery**(): [`SimpleSelectQuery`](../classes/SimpleSelectQuery.md)

Defined in: [packages/core/src/models/SelectQuery.ts:55](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SelectQuery.ts#L55)

#### Returns

[`SimpleSelectQuery`](../classes/SimpleSelectQuery.md)

***

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:13](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L13)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](../classes/SqlComponent.md).[`getKind`](../classes/SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:17](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L17)

#### Type Parameters

##### T

`T`

#### Parameters

##### visitor

[`SqlComponentVisitor`](SqlComponentVisitor.md)&lt;`T`\&gt;

#### Returns

`T`

#### Inherited from

[`SqlComponent`](../classes/SqlComponent.md).[`accept`](../classes/SqlComponent.md#accept)

***

### toSqlString()

> **toSqlString**(`formatter`): `string`

Defined in: [packages/core/src/models/SqlComponent.ts:21](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L21)

#### Parameters

##### formatter

[`SqlComponentVisitor`](SqlComponentVisitor.md)&lt;`string`\&gt;

#### Returns

`string`

#### Inherited from

[`SqlComponent`](../classes/SqlComponent.md).[`toSqlString`](../classes/SqlComponent.md#tosqlstring)

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

#### Inherited from

[`SqlComponent`](../classes/SqlComponent.md).[`addPositionedComments`](../classes/SqlComponent.md#addpositionedcomments)

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

#### Inherited from

[`SqlComponent`](../classes/SqlComponent.md).[`getPositionedComments`](../classes/SqlComponent.md#getpositionedcomments)

***

### getAllPositionedComments()

> **getAllPositionedComments**(): `string`[]

Defined in: [packages/core/src/models/SqlComponent.ts:64](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SqlComponent.ts#L64)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](../classes/SqlComponent.md).[`getAllPositionedComments`](../classes/SqlComponent.md#getallpositionedcomments)
</div>
