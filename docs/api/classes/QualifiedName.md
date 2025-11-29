<div v-pre>
# Class: QualifiedName

Defined in: [packages/core/src/models/ValueComponent.ts:457](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/ValueComponent.ts#L457)

Represents a qualified name with optional namespaces (e.g. schema.table, db.schema.function)

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new QualifiedName**(`namespaces`, `name`): `QualifiedName`

Defined in: [packages/core/src/models/ValueComponent.ts:465](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/ValueComponent.ts#L465)

#### Parameters

##### namespaces

`null` | `string` | `string`[] | [`IdentifierString`](IdentifierString.md)[]

##### name

`string` | [`RawString`](RawString.md) | [`IdentifierString`](IdentifierString.md)

#### Returns

`QualifiedName`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

***

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/ValueComponent.ts:458](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/ValueComponent.ts#L458)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### namespaces

> **namespaces**: `null` \| [`IdentifierString`](IdentifierString.md)[]

Defined in: [packages/core/src/models/ValueComponent.ts:461](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/ValueComponent.ts#L461)

List of namespaces (e.g. schema, database)

***

### name

> **name**: [`RawString`](RawString.md) \| [`IdentifierString`](IdentifierString.md)

Defined in: [packages/core/src/models/ValueComponent.ts:463](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/ValueComponent.ts#L463)

The actual name (e.g. table, function, type, column)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)

***

### toString()

> **toString**(): `string`

Defined in: [packages/core/src/models/ValueComponent.ts:476](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/models/ValueComponent.ts#L476)

Returns the full qualified name as a string (dot-separated)

#### Returns

`string`
</div>
