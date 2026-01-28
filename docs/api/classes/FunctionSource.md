<div v-pre>
# Class: FunctionSource

Defined in: [packages/core/src/models/Clause.ts:194](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L194)

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new FunctionSource**(`name`, `argument`, `withOrdinality`): `FunctionSource`

Defined in: [packages/core/src/models/Clause.ts:203](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L203)

#### Parameters

##### name

`string` | [`IdentifierString`](IdentifierString.md) | \{ `namespaces`: `null` \| `string`[] \| [`IdentifierString`](IdentifierString.md)[]; `name`: `string` \| [`RawString`](RawString.md) \| [`IdentifierString`](IdentifierString.md); \}

##### argument

`null` | [`ValueComponent`](../type-aliases/ValueComponent.md)

##### withOrdinality

`boolean` = `false`

#### Returns

`FunctionSource`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/Clause.ts:195](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L195)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### qualifiedName

> **qualifiedName**: [`QualifiedName`](QualifiedName.md)

Defined in: [packages/core/src/models/Clause.ts:196](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L196)

***

### argument

> **argument**: `null` \| [`ValueComponent`](../type-aliases/ValueComponent.md)

Defined in: [packages/core/src/models/Clause.ts:197](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L197)

***

### withOrdinality

> **withOrdinality**: `boolean`

Defined in: [packages/core/src/models/Clause.ts:202](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L202)

Indicates whether the function source was declared with WITH ORDINALITY,
as found in table-function expressions such as `unnest(...) WITH ORDINALITY`.

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

## Accessors

### namespaces

#### Get Signature

> **get** **namespaces**(): `null` \| [`IdentifierString`](IdentifierString.md)[]

Defined in: [packages/core/src/models/Clause.ts:223](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L223)

For backward compatibility: returns the namespaces as IdentifierString[] | null (readonly)

##### Returns

`null` \| [`IdentifierString`](IdentifierString.md)[]

***

### name

#### Get Signature

> **get** **name**(): [`RawString`](RawString.md) \| [`IdentifierString`](IdentifierString.md)

Defined in: [packages/core/src/models/Clause.ts:229](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/models/Clause.ts#L229)

For backward compatibility: returns the function name as RawString | IdentifierString (readonly)

##### Returns

[`RawString`](RawString.md) \| [`IdentifierString`](IdentifierString.md)

## Methods

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
