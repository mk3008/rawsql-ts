<div v-pre>
# Class: DropTableParser

Defined in: [packages/core/src/parsers/DropTableParser.ts:10](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/parsers/DropTableParser.ts#L10)

Parses DROP TABLE statements.

## Constructors

### Constructor

> **new DropTableParser**(): `DropTableParser`

#### Returns

`DropTableParser`

## Methods

### parse()

> `static` **parse**(`sql`): [`DropTableStatement`](DropTableStatement.md)

Defined in: [packages/core/src/parsers/DropTableParser.ts:11](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/parsers/DropTableParser.ts#L11)

#### Parameters

##### sql

`string`

#### Returns

[`DropTableStatement`](DropTableStatement.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/DropTableParser.ts:21](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/parsers/DropTableParser.ts#L21)

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

##### index

`number`

#### Returns

`object`

##### value

> **value**: [`DropTableStatement`](DropTableStatement.md)

##### newIndex

> **newIndex**: `number`
</div>
