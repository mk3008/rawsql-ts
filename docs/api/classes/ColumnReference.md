<div v-pre>
# Class: ColumnReference

Defined in: [packages/core/src/models/ValueComponent.ts:47](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/ValueComponent.ts#L47)

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new ColumnReference**(`namespaces`, `column`): `ColumnReference`

Defined in: [packages/core/src/models/ValueComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/ValueComponent.ts#L66)

#### Parameters

##### namespaces

`null` | `string` | `string`[] | [`IdentifierString`](IdentifierString.md)[]

##### column

`string` | [`IdentifierString`](IdentifierString.md)

#### Returns

`ColumnReference`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

***

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/ValueComponent.ts:65](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/ValueComponent.ts#L65)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### qualifiedName

> **qualifiedName**: [`QualifiedName`](QualifiedName.md)

Defined in: [packages/core/src/models/ValueComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/ValueComponent.ts#L66)

## Accessors

### namespaces

#### Get Signature

> **get** **namespaces**(): `null` \| [`IdentifierString`](IdentifierString.md)[]

Defined in: [packages/core/src/models/ValueComponent.ts:51](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/ValueComponent.ts#L51)

For backward compatibility: returns the namespaces as IdentifierString[] | null (readonly)

##### Returns

`null` \| [`IdentifierString`](IdentifierString.md)[]

***

### column

#### Get Signature

> **get** **column**(): [`IdentifierString`](IdentifierString.md)

Defined in: [packages/core/src/models/ValueComponent.ts:57](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/ValueComponent.ts#L57)

For backward compatibility: returns the column name as IdentifierString (readonly)

##### Returns

[`IdentifierString`](IdentifierString.md)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)

***

### toString()

> **toString**(): `string`

Defined in: [packages/core/src/models/ValueComponent.ts:72](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/ValueComponent.ts#L72)

Returns a string representation of an object.

#### Returns

`string`

***

### getNamespace()

> **getNamespace**(): `string`

Defined in: [packages/core/src/models/ValueComponent.ts:75](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/models/ValueComponent.ts#L75)

#### Returns

`string`
</div>
