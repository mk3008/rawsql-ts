<div v-pre>
# Interface: FormattingLexeme

Defined in: [packages/core/src/models/FormattingLexeme.ts:6](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/models/FormattingLexeme.ts#L6)

Extended lexeme interface that preserves formatting information

## Extends

- [`Lexeme`](Lexeme.md)

## Properties

### followingWhitespace

> **followingWhitespace**: `string`

Defined in: [packages/core/src/models/FormattingLexeme.ts:10](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/models/FormattingLexeme.ts#L10)

Whitespace that follows this lexeme (spaces, tabs, newlines)

***

### inlineComments

> **inlineComments**: `string`[]

Defined in: [packages/core/src/models/FormattingLexeme.ts:15](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/models/FormattingLexeme.ts#L15)

Inline comments that appear on the same line as this lexeme

***

### position

> **position**: [`LexemePosition`](LexemePosition.md)

Defined in: [packages/core/src/models/FormattingLexeme.ts:20](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/models/FormattingLexeme.ts#L20)

Enhanced position information for precise reconstruction

#### Overrides

[`Lexeme`](Lexeme.md).[`position`](Lexeme.md#position)

***

### type

> **type**: `number`

Defined in: [packages/core/src/models/Lexeme.ts:43](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/models/Lexeme.ts#L43)

#### Inherited from

[`Lexeme`](Lexeme.md).[`type`](Lexeme.md#type)

***

### value

> **value**: `string`

Defined in: [packages/core/src/models/Lexeme.ts:44](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/models/Lexeme.ts#L44)

#### Inherited from

[`Lexeme`](Lexeme.md).[`value`](Lexeme.md#value)

***

### comments

> **comments**: `null` \| `string`[]

Defined in: [packages/core/src/models/Lexeme.ts:45](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/models/Lexeme.ts#L45)

#### Inherited from

[`Lexeme`](Lexeme.md).[`comments`](Lexeme.md#comments)

***

### positionedComments?

> `optional` **positionedComments**: [`LexemePositionedComment`](LexemePositionedComment.md)[]

Defined in: [packages/core/src/models/Lexeme.ts:46](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/models/Lexeme.ts#L46)

#### Inherited from

[`Lexeme`](Lexeme.md).[`positionedComments`](Lexeme.md#positionedcomments)
</div>
