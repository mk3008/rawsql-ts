<div v-pre>
# Class: DeleteQueryParser

Defined in: [packages/core/src/parsers/DeleteQueryParser.ts:12](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/parsers/DeleteQueryParser.ts#L12)

## Constructors

### Constructor

> **new DeleteQueryParser**(): `DeleteQueryParser`

#### Returns

`DeleteQueryParser`

## Methods

### parse()

> `static` **parse**(`query`): [`DeleteQuery`](DeleteQuery.md)

Defined in: [packages/core/src/parsers/DeleteQueryParser.ts:17](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/parsers/DeleteQueryParser.ts#L17)

Parse SQL string to DeleteQuery AST.

#### Parameters

##### query

`string`

SQL string

#### Returns

[`DeleteQuery`](DeleteQuery.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/DeleteQueryParser.ts:32](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/parsers/DeleteQueryParser.ts#L32)

Parse from lexeme array (for internal use and tests).

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

##### index

`number`

#### Returns

`object`

##### value

> **value**: [`DeleteQuery`](DeleteQuery.md)

##### newIndex

> **newIndex**: `number`
</div>
