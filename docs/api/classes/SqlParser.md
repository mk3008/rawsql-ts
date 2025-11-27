<div v-pre>
# Class: SqlParser

Defined in: [packages/core/src/parsers/SqlParser.ts:61](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/parsers/SqlParser.ts#L61)

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

Defined in: [packages/core/src/parsers/SqlParser.ts:62](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/parsers/SqlParser.ts#L62)

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

Defined in: [packages/core/src/parsers/SqlParser.ts:86](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/parsers/SqlParser.ts#L86)

#### Parameters

##### sql

`string`

##### options

[`SqlParserManyOptions`](../interfaces/SqlParserManyOptions.md) = `{}`

#### Returns

[`ParsedStatement`](../type-aliases/ParsedStatement.md)[]
</div>
