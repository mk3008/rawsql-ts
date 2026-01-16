<div v-pre>
# Class: DropTableParser

Defined in: [packages/core/src/parsers/DropTableParser.ts:10](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/parsers/DropTableParser.ts#L10)

Parses DROP TABLE statements.

## Constructors

### Constructor

> **new DropTableParser**(): `DropTableParser`

#### Returns

`DropTableParser`

## Methods

### parse()

> `static` **parse**(`sql`): [`DropTableStatement`](DropTableStatement.md)

Defined in: [packages/core/src/parsers/DropTableParser.ts:11](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/parsers/DropTableParser.ts#L11)

#### Parameters

##### sql

`string`

#### Returns

[`DropTableStatement`](DropTableStatement.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/DropTableParser.ts:21](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/parsers/DropTableParser.ts#L21)

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
