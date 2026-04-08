<div v-pre>
# Class: CommentOnParser

Defined in: [packages/core/src/parsers/CommentOnParser.ts:11](https://github.com/mk3008/rawsql-ts/blob/c0f0f68e19e11de9d7a4c6a3a888252dc2ccb053/packages/core/src/parsers/CommentOnParser.ts#L11)

Parses COMMENT ON TABLE/COLUMN statements.

## Constructors

### Constructor

> **new CommentOnParser**(): `CommentOnParser`

#### Returns

`CommentOnParser`

## Methods

### parse()

> `static` **parse**(`sql`): [`CommentOnStatement`](CommentOnStatement.md)

Defined in: [packages/core/src/parsers/CommentOnParser.ts:17](https://github.com/mk3008/rawsql-ts/blob/c0f0f68e19e11de9d7a4c6a3a888252dc2ccb053/packages/core/src/parsers/CommentOnParser.ts#L17)

Parses a full SQL string containing a single COMMENT ON statement.

#### Parameters

##### sql

`string`

SQL text containing one COMMENT ON TABLE/COLUMN statement.

#### Returns

[`CommentOnStatement`](CommentOnStatement.md)

Parsed COMMENT ON statement model.

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/CommentOnParser.ts:33](https://github.com/mk3008/rawsql-ts/blob/c0f0f68e19e11de9d7a4c6a3a888252dc2ccb053/packages/core/src/parsers/CommentOnParser.ts#L33)

Parses COMMENT ON tokens from a lexeme array starting at the specified index.

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

Tokenized SQL lexemes.

##### index

`number`

Lexeme index where COMMENT ON parsing starts.

#### Returns

`object`

Parsed statement and the next unread lexeme index.

##### value

> **value**: [`CommentOnStatement`](CommentOnStatement.md)

##### newIndex

> **newIndex**: `number`
</div>
