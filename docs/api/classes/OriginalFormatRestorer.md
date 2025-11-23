<div v-pre>
# Class: OriginalFormatRestorer

Defined in: [packages/core/src/formatters/OriginalFormatRestorer.ts:7](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/formatters/OriginalFormatRestorer.ts#L7)

Restores SQL strings from FormattingLexeme arrays while preserving original formatting
This class handles the restoration of SQL text with exact whitespace, comments, and indentation

## Constructors

### Constructor

> **new OriginalFormatRestorer**(): `OriginalFormatRestorer`

#### Returns

`OriginalFormatRestorer`

## Methods

### restore()

> **restore**(`lexemes`): `string`

Defined in: [packages/core/src/formatters/OriginalFormatRestorer.ts:14](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/formatters/OriginalFormatRestorer.ts#L14)

Restores SQL string from FormattingLexeme array preserving original formatting

#### Parameters

##### lexemes

[`FormattingLexeme`](../interfaces/FormattingLexeme.md)[]

Array of FormattingLexeme with formatting information

#### Returns

`string`

Restored SQL string with original formatting preserved

***

### restoreWithComments()

> **restoreWithComments**(`lexemes`, `includeComments`): `string`

Defined in: [packages/core/src/formatters/OriginalFormatRestorer.ts:40](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/formatters/OriginalFormatRestorer.ts#L40)

Restores SQL with inline comments preserved at their original positions

#### Parameters

##### lexemes

[`FormattingLexeme`](../interfaces/FormattingLexeme.md)[]

Array of FormattingLexeme with formatting information

##### includeComments

`boolean` = `true`

Whether to include inline comments in output

#### Returns

`string`

Restored SQL string

***

### analyzeFormatting()

> **analyzeFormatting**(`lexemes`): `object`

Defined in: [packages/core/src/formatters/OriginalFormatRestorer.ts:75](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/formatters/OriginalFormatRestorer.ts#L75)

Extracts formatting patterns from FormattingLexemes for analysis

#### Parameters

##### lexemes

[`FormattingLexeme`](../interfaces/FormattingLexeme.md)[]

Array of FormattingLexeme

#### Returns

`object`

Object containing formatting statistics

##### totalWhitespace

> **totalWhitespace**: `number`

##### totalComments

> **totalComments**: `number`

##### indentationStyle

> **indentationStyle**: `"none"` \| `"spaces"` \| `"tabs"` \| `"mixed"`

##### averageIndentSize

> **averageIndentSize**: `number`

***

### validateFormattingLexemes()

> **validateFormattingLexemes**(`lexemes`): `object`

Defined in: [packages/core/src/formatters/OriginalFormatRestorer.ts:135](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/formatters/OriginalFormatRestorer.ts#L135)

Validates that lexemes contain proper formatting information

#### Parameters

##### lexemes

[`FormattingLexeme`](../interfaces/FormattingLexeme.md)[]

Array of FormattingLexeme to validate

#### Returns

`object`

Validation result with details

##### isValid

> **isValid**: `boolean`

##### issues

> **issues**: `string`[]
</div>
