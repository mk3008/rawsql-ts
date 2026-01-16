<div v-pre>
# Class: MergeQueryParser

Defined in: [packages/core/src/parsers/MergeQueryParser.ts:14](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/parsers/MergeQueryParser.ts#L14)

## Constructors

### Constructor

> **new MergeQueryParser**(): `MergeQueryParser`

#### Returns

`MergeQueryParser`

## Methods

### parse()

> `static` **parse**(`query`): [`MergeQuery`](MergeQuery.md)

Defined in: [packages/core/src/parsers/MergeQueryParser.ts:19](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/parsers/MergeQueryParser.ts#L19)

Parse SQL string to MergeQuery AST.

#### Parameters

##### query

`string`

SQL string

#### Returns

[`MergeQuery`](MergeQuery.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/MergeQueryParser.ts:32](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/parsers/MergeQueryParser.ts#L32)

Parse from lexeme array (for internal use and tests).

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

##### index

`number`

#### Returns

`object`

##### value

> **value**: [`MergeQuery`](MergeQuery.md)

##### newIndex

> **newIndex**: `number`
</div>
