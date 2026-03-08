<div v-pre>
# Class: SqlParser

Defined in: [packages/core/src/parsers/SqlParser.ts:87](https://github.com/mk3008/rawsql-ts/blob/c806394179a44299deb73d3295756815d95eb53b/packages/core/src/parsers/SqlParser.ts#L87)

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

Defined in: [packages/core/src/parsers/SqlParser.ts:88](https://github.com/mk3008/rawsql-ts/blob/c806394179a44299deb73d3295756815d95eb53b/packages/core/src/parsers/SqlParser.ts#L88)

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

Defined in: [packages/core/src/parsers/SqlParser.ts:112](https://github.com/mk3008/rawsql-ts/blob/c806394179a44299deb73d3295756815d95eb53b/packages/core/src/parsers/SqlParser.ts#L112)

#### Parameters

##### sql

`string`

##### options

[`SqlParserManyOptions`](../interfaces/SqlParserManyOptions.md) = `{}`

#### Returns

[`ParsedStatement`](../type-aliases/ParsedStatement.md)[]
</div>
