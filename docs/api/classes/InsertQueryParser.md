<div v-pre>
# Class: InsertQueryParser

Defined in: [packages/core/src/parsers/InsertQueryParser.ts:17](https://github.com/mk3008/rawsql-ts/blob/c0f0f68e19e11de9d7a4c6a3a888252dc2ccb053/packages/core/src/parsers/InsertQueryParser.ts#L17)

## Constructors

### Constructor

> **new InsertQueryParser**(): `InsertQueryParser`

#### Returns

`InsertQueryParser`

## Methods

### parse()

> `static` **parse**(`query`): [`InsertQuery`](InsertQuery.md)

Defined in: [packages/core/src/parsers/InsertQueryParser.ts:22](https://github.com/mk3008/rawsql-ts/blob/c0f0f68e19e11de9d7a4c6a3a888252dc2ccb053/packages/core/src/parsers/InsertQueryParser.ts#L22)

Parse SQL string to InsertQuery AST.

#### Parameters

##### query

`string`

SQL string

#### Returns

[`InsertQuery`](InsertQuery.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/InsertQueryParser.ts:35](https://github.com/mk3008/rawsql-ts/blob/c0f0f68e19e11de9d7a4c6a3a888252dc2ccb053/packages/core/src/parsers/InsertQueryParser.ts#L35)

Parse from lexeme array (for internal use and tests)

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

##### index

`number`

#### Returns

`object`

##### value

> **value**: [`InsertQuery`](InsertQuery.md)

##### newIndex

> **newIndex**: `number`
</div>
