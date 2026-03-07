<div v-pre>
# Class: CreateTableParser

Defined in: [packages/core/src/parsers/CreateTableParser.ts:48](https://github.com/mk3008/rawsql-ts/blob/fffd661d21a357a361d2a4534bd85e1192a0bdcf/packages/core/src/parsers/CreateTableParser.ts#L48)

Parses CREATE TABLE statements (DDL or AS SELECT) into CreateTableQuery models.

## Constructors

### Constructor

> **new CreateTableParser**(): `CreateTableParser`

#### Returns

`CreateTableParser`

## Methods

### parse()

> `static` **parse**(`query`): [`CreateTableQuery`](CreateTableQuery.md)

Defined in: [packages/core/src/parsers/CreateTableParser.ts:110](https://github.com/mk3008/rawsql-ts/blob/fffd661d21a357a361d2a4534bd85e1192a0bdcf/packages/core/src/parsers/CreateTableParser.ts#L110)

Parse SQL string to CreateTableQuery AST.

#### Parameters

##### query

`string`

#### Returns

[`CreateTableQuery`](CreateTableQuery.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/CreateTableParser.ts:123](https://github.com/mk3008/rawsql-ts/blob/fffd661d21a357a361d2a4534bd85e1192a0bdcf/packages/core/src/parsers/CreateTableParser.ts#L123)

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
