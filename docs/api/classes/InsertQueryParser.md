<div v-pre>
# Class: InsertQueryParser

Defined in: [packages/core/src/parsers/InsertQueryParser.ts:16](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/parsers/InsertQueryParser.ts#L16)

## Constructors

### Constructor

> **new InsertQueryParser**(): `InsertQueryParser`

#### Returns

`InsertQueryParser`

## Methods

### parse()

> `static` **parse**(`query`): [`InsertQuery`](InsertQuery.md)

Defined in: [packages/core/src/parsers/InsertQueryParser.ts:21](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/parsers/InsertQueryParser.ts#L21)

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

Defined in: [packages/core/src/parsers/InsertQueryParser.ts:34](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/parsers/InsertQueryParser.ts#L34)

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
