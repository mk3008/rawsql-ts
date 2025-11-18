<div v-pre>
# Class: SqlParser

Defined in: [packages/core/src/parsers/SqlParser.ts:61](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/parsers/SqlParser.ts#L61)

Canonical entry point for SQL parsing.
Delegates to dedicated parsers for SELECT, INSERT, UPDATE, and DELETE statements, and is designed to embrace additional statement types next.

## Constructors

### Constructor

> **new SqlParser**(): `SqlParser`

#### Returns

`SqlParser`

## Methods

### parse()

> `static` **parse**(`sql`, `options`): [`ParsedStatement`](../type-aliases/ParsedStatement.md)

Defined in: [packages/core/src/parsers/SqlParser.ts:62](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/parsers/SqlParser.ts#L62)

#### Parameters

##### sql

`string`

##### options

[`SqlParserOptions`](../interfaces/SqlParserOptions.md) = `{}`

#### Returns

[`ParsedStatement`](../type-aliases/ParsedStatement.md)

***

### parseMany()

> `static` **parseMany**(`sql`, `options`): [`ParsedStatement`](../type-aliases/ParsedStatement.md)[]

Defined in: [packages/core/src/parsers/SqlParser.ts:86](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/parsers/SqlParser.ts#L86)

#### Parameters

##### sql

`string`

##### options

[`SqlParserManyOptions`](../interfaces/SqlParserManyOptions.md) = `{}`

#### Returns

[`ParsedStatement`](../type-aliases/ParsedStatement.md)[]
</div>
