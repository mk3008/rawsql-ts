<div v-pre>
# Class: MergeQueryParser

Defined in: [packages/core/src/parsers/MergeQueryParser.ts:15](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/parsers/MergeQueryParser.ts#L15)

## Constructors

### Constructor

> **new MergeQueryParser**(): `MergeQueryParser`

#### Returns

`MergeQueryParser`

## Methods

### parse()

> `static` **parse**(`query`): [`MergeQuery`](MergeQuery.md)

Defined in: [packages/core/src/parsers/MergeQueryParser.ts:20](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/parsers/MergeQueryParser.ts#L20)

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

Defined in: [packages/core/src/parsers/MergeQueryParser.ts:33](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/parsers/MergeQueryParser.ts#L33)

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
