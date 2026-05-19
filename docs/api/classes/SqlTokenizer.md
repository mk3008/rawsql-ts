<div v-pre>
# Class: SqlTokenizer

Defined in: [packages/core/src/parsers/SqlTokenizer.ts:42](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/parsers/SqlTokenizer.ts#L42)

Class responsible for tokenizing SQL input.

## Constructors

### Constructor

> **new SqlTokenizer**(`input`): `SqlTokenizer`

Defined in: [packages/core/src/parsers/SqlTokenizer.ts:66](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/parsers/SqlTokenizer.ts#L66)

Initializes a new instance of the SqlTokenizer.

#### Parameters

##### input

`string`

#### Returns

`SqlTokenizer`

## Methods

### tokenize()

#### Call Signature

> **tokenize**(): [`Lexeme`](../interfaces/Lexeme.md)[]

Defined in: [packages/core/src/parsers/SqlTokenizer.ts:134](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/parsers/SqlTokenizer.ts#L134)

Tokenizes the input SQL with optional formatting preservation.

##### Returns

[`Lexeme`](../interfaces/Lexeme.md)[]

#### Call Signature

> **tokenize**(`options`): [`FormattingLexeme`](../interfaces/FormattingLexeme.md)[]

Defined in: [packages/core/src/parsers/SqlTokenizer.ts:135](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/parsers/SqlTokenizer.ts#L135)

Tokenizes the input SQL with optional formatting preservation.

##### Parameters

###### options

###### preserveFormatting

`true`

##### Returns

[`FormattingLexeme`](../interfaces/FormattingLexeme.md)[]

#### Call Signature

> **tokenize**(`options?`): [`FormattingLexeme`](../interfaces/FormattingLexeme.md)[] \| [`Lexeme`](../interfaces/Lexeme.md)[]

Defined in: [packages/core/src/parsers/SqlTokenizer.ts:136](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/parsers/SqlTokenizer.ts#L136)

Tokenizes the input SQL with optional formatting preservation.

##### Parameters

###### options?

[`TokenizeOptions`](../interfaces/TokenizeOptions.md)

##### Returns

[`FormattingLexeme`](../interfaces/FormattingLexeme.md)[] \| [`Lexeme`](../interfaces/Lexeme.md)[]

***

### ~~readLexmes()~~

> **readLexmes**(): [`Lexeme`](../interfaces/Lexeme.md)[]

Defined in: [packages/core/src/parsers/SqlTokenizer.ts:151](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/parsers/SqlTokenizer.ts#L151)

#### Returns

[`Lexeme`](../interfaces/Lexeme.md)[]

#### Deprecated

Use [readLexemes](#readlexemes) (correct spelling) instead.
This legacy alias remains for backwards compatibility and delegates to the new method.

***

### readLexemes()

> **readLexemes**(): [`Lexeme`](../interfaces/Lexeme.md)[]

Defined in: [packages/core/src/parsers/SqlTokenizer.ts:161](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/parsers/SqlTokenizer.ts#L161)

Reads the lexemes from the input string.

#### Returns

[`Lexeme`](../interfaces/Lexeme.md)[]

An array of lexemes extracted from the input string.

#### Throws

Error if an unexpected character is encountered.

***

### readNextStatement()

> **readNextStatement**(`startPosition`, `carryComments`): [`StatementLexemeResult`](../interfaces/StatementLexemeResult.md) \| `null`

Defined in: [packages/core/src/parsers/SqlTokenizer.ts:174](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/parsers/SqlTokenizer.ts#L174)

#### Parameters

##### startPosition

`number` = `0`

##### carryComments

`string`[] | `null`

#### Returns

[`StatementLexemeResult`](../interfaces/StatementLexemeResult.md) \| `null`
</div>
