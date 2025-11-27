<div v-pre>
# Interface: ModificationInfo

Defined in: [packages/core/src/models/FormattingLexeme.ts:26](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/models/FormattingLexeme.ts#L26)

Metadata for tracking modifications during AST transformations

## Properties

### renames

> **renames**: `Map`&lt;`string`, `string`\&gt;

Defined in: [packages/core/src/models/FormattingLexeme.ts:30](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/models/FormattingLexeme.ts#L30)

Map of original values to new values for renamed items

***

### insertions

> **insertions**: `object`[]

Defined in: [packages/core/src/models/FormattingLexeme.ts:35](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/models/FormattingLexeme.ts#L35)

Positions where new content was inserted

#### position

> **position**: `number`

#### content

> **content**: `string`

***

### deletions

> **deletions**: `object`[]

Defined in: [packages/core/src/models/FormattingLexeme.ts:40](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/models/FormattingLexeme.ts#L40)

Ranges that were deleted from original content

#### start

> **start**: `number`

#### end

> **end**: `number`
</div>
