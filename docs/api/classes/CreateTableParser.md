<div v-pre>
# Class: CreateTableParser

Defined in: [packages/core/src/parsers/CreateTableParser.ts:48](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/parsers/CreateTableParser.ts#L48)

Parses CREATE TABLE statements (DDL or AS SELECT) into CreateTableQuery models.

## Constructors

### Constructor

> **new CreateTableParser**(): `CreateTableParser`

#### Returns

`CreateTableParser`

## Methods

### parse()

> `static` **parse**(`query`): [`CreateTableQuery`](CreateTableQuery.md)

Defined in: [packages/core/src/parsers/CreateTableParser.ts:101](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/parsers/CreateTableParser.ts#L101)

Parse SQL string to CreateTableQuery AST.

#### Parameters

##### query

`string`

#### Returns

[`CreateTableQuery`](CreateTableQuery.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/CreateTableParser.ts:114](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/parsers/CreateTableParser.ts#L114)

Parse from lexeme array (for internal use and tests).

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

##### index

`number`

#### Returns

`object`

##### value

> **value**: [`CreateTableQuery`](CreateTableQuery.md)

##### newIndex

> **newIndex**: `number`
</div>
