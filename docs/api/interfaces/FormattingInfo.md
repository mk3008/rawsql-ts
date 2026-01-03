<div v-pre>
# Interface: FormattingInfo

Defined in: [packages/core/src/models/FormattingLexeme.ts:46](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/models/FormattingLexeme.ts#L46)

Container for formatting information associated with AST nodes

## Properties

### originalLexemes

> **originalLexemes**: [`FormattingLexeme`](FormattingLexeme.md)[]

Defined in: [packages/core/src/models/FormattingLexeme.ts:50](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/models/FormattingLexeme.ts#L50)

Original lexemes with formatting information

***

### startPosition

> **startPosition**: `number`

Defined in: [packages/core/src/models/FormattingLexeme.ts:55](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/models/FormattingLexeme.ts#L55)

Start position in original text

***

### endPosition

> **endPosition**: `number`

Defined in: [packages/core/src/models/FormattingLexeme.ts:60](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/models/FormattingLexeme.ts#L60)

End position in original text

***

### modifications?

> `optional` **modifications**: [`ModificationInfo`](ModificationInfo.md)

Defined in: [packages/core/src/models/FormattingLexeme.ts:65](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/models/FormattingLexeme.ts#L65)

Modifications made during transformations

***

### whitespacePatterns?

> `optional` **whitespacePatterns**: `string`[]

Defined in: [packages/core/src/models/FormattingLexeme.ts:70](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/models/FormattingLexeme.ts#L70)

Original whitespace patterns for reconstruction
</div>
