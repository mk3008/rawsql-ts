<div v-pre>
# Interface: SelectQuery

Defined in: [packages/core/src/models/SelectQuery.ts:88](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SelectQuery.ts#L88)

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

Defined in: [packages/core/src/models/SelectQuery.ts:89](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SelectQuery.ts#L89)

***

### headerComments

> **headerComments**: `null` \| `string`[]

Defined in: [packages/core/src/models/SelectQuery.ts:90](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SelectQuery.ts#L90)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`DeleteQuery`](../classes/DeleteQuery.md).[`comments`](../classes/DeleteQuery.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`DeleteQuery`](../classes/DeleteQuery.md).[`positionedComments`](../classes/DeleteQuery.md#positionedcomments)

## Methods

### setParameter()

> **setParameter**(`name`, `value`): `this`

Defined in: [packages/core/src/models/SelectQuery.ts:91](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SelectQuery.ts#L91)

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

Defined in: [packages/core/src/models/SelectQuery.ts:92](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SelectQuery.ts#L92)

#### Returns

[`SimpleSelectQuery`](../classes/SimpleSelectQuery.md)

***

### toInsertQuery()

> **toInsertQuery**(`options`): [`InsertQuery`](../classes/InsertQuery.md)

Defined in: [packages/core/src/models/SelectQuery.ts:93](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SelectQuery.ts#L93)

#### Parameters

##### options

[`InsertQueryConversionOptions`](InsertQueryConversionOptions.md)

#### Returns

[`InsertQuery`](../classes/InsertQuery.md)

***

### toUpdateQuery()

> **toUpdateQuery**(`options`): [`UpdateQuery`](../classes/UpdateQuery.md)

Defined in: [packages/core/src/models/SelectQuery.ts:94](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SelectQuery.ts#L94)

#### Parameters

##### options

[`UpdateQueryConversionOptions`](UpdateQueryConversionOptions.md)

#### Returns

[`UpdateQuery`](../classes/UpdateQuery.md)

***

### toDeleteQuery()

> **toDeleteQuery**(`options`): [`DeleteQuery`](../classes/DeleteQuery.md)

Defined in: [packages/core/src/models/SelectQuery.ts:95](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SelectQuery.ts#L95)

#### Parameters

##### options

[`DeleteQueryConversionOptions`](DeleteQueryConversionOptions.md)

#### Returns

[`DeleteQuery`](../classes/DeleteQuery.md)

***

### toMergeQuery()

> **toMergeQuery**(`options`): [`MergeQuery`](../classes/MergeQuery.md)

Defined in: [packages/core/src/models/SelectQuery.ts:96](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SelectQuery.ts#L96)

#### Parameters

##### options

[`MergeQueryConversionOptions`](MergeQueryConversionOptions.md)

#### Returns

[`MergeQuery`](../classes/MergeQuery.md)

***

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](../classes/SqlComponent.md).[`getKind`](../classes/SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](../classes/SqlComponent.md).[`getAllPositionedComments`](../classes/SqlComponent.md#getallpositionedcomments)
</div>
