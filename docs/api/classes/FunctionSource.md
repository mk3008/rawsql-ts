<div v-pre>
# Class: FunctionSource

Defined in: [packages/core/src/models/Clause.ts:194](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/Clause.ts#L194)

## Extends

- [`SqlComponent`](SqlComponent.md)

## Constructors

### Constructor

> **new FunctionSource**(`name`, `argument`): `FunctionSource`

Defined in: [packages/core/src/models/Clause.ts:198](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/Clause.ts#L198)

#### Parameters

##### name

`string` | [`IdentifierString`](IdentifierString.md) | \{ `namespaces`: `null` \| `string`[] \| [`IdentifierString`](IdentifierString.md)[]; `name`: `string` \| [`RawString`](RawString.md) \| [`IdentifierString`](IdentifierString.md); \}

##### argument

`null` | [`ValueComponent`](../type-aliases/ValueComponent.md)

#### Returns

`FunctionSource`

#### Overrides

[`SqlComponent`](SqlComponent.md).[`constructor`](SqlComponent.md#constructor)

## Properties

### kind

> `static` **kind**: `symbol`

Defined in: [packages/core/src/models/Clause.ts:195](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/Clause.ts#L195)

#### Overrides

[`SqlComponent`](SqlComponent.md).[`kind`](SqlComponent.md#kind)

***

### qualifiedName

> **qualifiedName**: [`QualifiedName`](QualifiedName.md)

Defined in: [packages/core/src/models/Clause.ts:196](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/Clause.ts#L196)

***

### argument

> **argument**: `null` \| [`ValueComponent`](../type-aliases/ValueComponent.md)

Defined in: [packages/core/src/models/Clause.ts:197](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/Clause.ts#L197)

***

### comments

> **comments**: `null` \| `string`[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:29](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L29)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`comments`](SqlComponent.md#comments)

***

### positionedComments

> **positionedComments**: `null` \| [`PositionedComment`](../interfaces/PositionedComment.md)[] = `null`

Defined in: [packages/core/src/models/SqlComponent.ts:32](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L32)

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`positionedComments`](SqlComponent.md#positionedcomments)

## Accessors

### namespaces

#### Get Signature

> **get** **namespaces**(): `null` \| [`IdentifierString`](IdentifierString.md)[]

Defined in: [packages/core/src/models/Clause.ts:216](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/Clause.ts#L216)

For backward compatibility: returns the namespaces as IdentifierString[] | null (readonly)

##### Returns

`null` \| [`IdentifierString`](IdentifierString.md)[]

***

### name

#### Get Signature

> **get** **name**(): [`RawString`](RawString.md) \| [`IdentifierString`](IdentifierString.md)

Defined in: [packages/core/src/models/Clause.ts:222](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/Clause.ts#L222)

For backward compatibility: returns the function name as RawString | IdentifierString (readonly)

##### Returns

[`RawString`](RawString.md) \| [`IdentifierString`](IdentifierString.md)

## Methods

### getKind()

> **getKind**(): `symbol`

Defined in: [packages/core/src/models/SqlComponent.ts:15](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L15)

#### Returns

`symbol`

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getKind`](SqlComponent.md#getkind)

***

### accept()

> **accept**&lt;`T`\&gt;(`visitor`): `T`

Defined in: [packages/core/src/models/SqlComponent.ts:19](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L19)

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

Defined in: [packages/core/src/models/SqlComponent.ts:23](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L23)

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

Defined in: [packages/core/src/models/SqlComponent.ts:37](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L37)

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

Defined in: [packages/core/src/models/SqlComponent.ts:56](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L56)

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

Defined in: [packages/core/src/models/SqlComponent.ts:66](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/models/SqlComponent.ts#L66)

Get all positioned comments as a flat array in order (before, after)

#### Returns

`string`[]

#### Inherited from

[`SqlComponent`](SqlComponent.md).[`getAllPositionedComments`](SqlComponent.md#getallpositionedcomments)
</div>
