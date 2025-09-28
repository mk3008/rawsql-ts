<div v-pre>
# Interface: CTEDecomposerOptions

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:31](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/CTEQueryDecomposer.ts#L31)

Options for CTEQueryDecomposer extending SqlFormatterOptions

## Extends

- [`SqlFormatterOptions`](SqlFormatterOptions.md)

## Properties

### addComments?

> `optional` **addComments**: `boolean`

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:33](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/CTEQueryDecomposer.ts#L33)

Whether to add comments to decomposed queries showing metadata and dependencies

***

### indentSize?

> `optional` **indentSize**: `number`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:39](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L39)

Number of spaces for indentation

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`indentSize`](SqlFormatterOptions.md#indentsize)

***

### indentChar?

> `optional` **indentChar**: `string`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:41](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L41)

Character to use for indentation ('space' or 'tab')

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`indentChar`](SqlFormatterOptions.md#indentchar)

***

### newline?

> `optional` **newline**: `NewlineOption`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:43](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L43)

Newline character style

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`newline`](SqlFormatterOptions.md#newline)

***

### keywordCase?

> `optional` **keywordCase**: `"none"` \| `"upper"` \| `"lower"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:45](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L45)

Case transformation for SQL keywords

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`keywordCase`](SqlFormatterOptions.md#keywordcase)

***

### commaBreak?

> `optional` **commaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:47](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L47)

Style for comma line breaks

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`commaBreak`](SqlFormatterOptions.md#commabreak)

***

### cteCommaBreak?

> `optional` **cteCommaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:49](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L49)

Style for comma line breaks inside WITH clause definitions

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`cteCommaBreak`](SqlFormatterOptions.md#ctecommabreak)

***

### andBreak?

> `optional` **andBreak**: `AndBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:51](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L51)

Style for AND/OR line breaks

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`andBreak`](SqlFormatterOptions.md#andbreak)

***

### exportComment?

> `optional` **exportComment**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:53](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L53)

Whether to export comments in formatted output

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`exportComment`](SqlFormatterOptions.md#exportcomment)

***

### strictCommentPlacement?

> `optional` **strictCommentPlacement**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:55](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L55)

Whether to only export comments from clause-level keywords

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`strictCommentPlacement`](SqlFormatterOptions.md#strictcommentplacement)

***

### commentStyle?

> `optional` **commentStyle**: [`CommentStyle`](../type-aliases/CommentStyle.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:57](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L57)

Comment formatting style

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`commentStyle`](SqlFormatterOptions.md#commentstyle)

***

### withClauseStyle?

> `optional` **withClauseStyle**: [`WithClauseStyle`](../type-aliases/WithClauseStyle.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:59](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L59)

Formatting style for WITH clauses

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`withClauseStyle`](SqlFormatterOptions.md#withclausestyle)

***

### parenthesesOneLine?

> `optional` **parenthesesOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:61](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L61)

Keep parentheses content on one line regardless of AND/OR break settings

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`parenthesesOneLine`](SqlFormatterOptions.md#parenthesesoneline)

***

### betweenOneLine?

> `optional` **betweenOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:63](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L63)

Keep BETWEEN expressions on one line regardless of AND break settings

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`betweenOneLine`](SqlFormatterOptions.md#betweenoneline)

***

### valuesOneLine?

> `optional` **valuesOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:65](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L65)

Keep VALUES clause on one line regardless of comma break settings

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`valuesOneLine`](SqlFormatterOptions.md#valuesoneline)

***

### joinOneLine?

> `optional` **joinOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:67](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L67)

Keep JOIN conditions on one line regardless of AND/OR break settings

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`joinOneLine`](SqlFormatterOptions.md#joinoneline)

***

### caseOneLine?

> `optional` **caseOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:69](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L69)

Keep CASE expressions on one line regardless of formatting settings

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`caseOneLine`](SqlFormatterOptions.md#caseoneline)

***

### subqueryOneLine?

> `optional` **subqueryOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:71](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L71)

Keep subqueries (inline queries) on one line regardless of formatting settings

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`subqueryOneLine`](SqlFormatterOptions.md#subqueryoneline)

***

### preset?

> `optional` **preset**: `"mysql"` \| `"postgres"` \| `"sqlserver"` \| `"sqlite"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:87](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L87)

Database preset for formatting style ('mysql', 'postgres', 'sqlserver', 'sqlite')

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`preset`](SqlFormatterOptions.md#preset)

***

### identifierEscape?

> `optional` **identifierEscape**: `object`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:89](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L89)

Custom identifier escape characters (e.g., {start: '"', end: '"'} for PostgreSQL)

#### start

> **start**: `string`

#### end

> **end**: `string`

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`identifierEscape`](SqlFormatterOptions.md#identifierescape)

***

### parameterSymbol?

> `optional` **parameterSymbol**: `string` \| \{ `start`: `string`; `end`: `string`; \}

Defined in: [packages/core/src/transformers/SqlFormatter.ts:91](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L91)

Parameter symbol configuration for SQL parameters

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`parameterSymbol`](SqlFormatterOptions.md#parametersymbol)

***

### parameterStyle?

> `optional` **parameterStyle**: `"named"` \| `"indexed"` \| `"anonymous"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:93](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L93)

Style for parameter formatting

#### Inherited from

[`SqlFormatterOptions`](SqlFormatterOptions.md).[`parameterStyle`](SqlFormatterOptions.md#parameterstyle)
</div>
