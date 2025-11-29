<div v-pre>
# Class: CreateIndexParser

Defined in: [packages/core/src/parsers/CreateIndexParser.ts:17](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/parsers/CreateIndexParser.ts#L17)

Parses CREATE INDEX statements.

## Constructors

### Constructor

> **new CreateIndexParser**(): `CreateIndexParser`

#### Returns

`CreateIndexParser`

## Methods

### parse()

> `static` **parse**(`sql`): [`CreateIndexStatement`](CreateIndexStatement.md)

Defined in: [packages/core/src/parsers/CreateIndexParser.ts:18](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/parsers/CreateIndexParser.ts#L18)

#### Parameters

##### sql

`string`

#### Returns

[`CreateIndexStatement`](CreateIndexStatement.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/CreateIndexParser.ts:28](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/parsers/CreateIndexParser.ts#L28)

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

##### index

`number`

#### Returns

`object`

##### value

> **value**: [`CreateIndexStatement`](CreateIndexStatement.md)

##### newIndex

> **newIndex**: `number`
</div>
