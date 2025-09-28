<div v-pre>
# Interface: SqlFormatterOptions

Defined in: [packages/core/src/transformers/SqlFormatter.ts:85](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L85)

High level configuration accepted by SqlFormatter.

## Example

```typescript
const formatter = new SqlFormatter({ preset: 'postgres', commentStyle: 'smart' });
const { formattedSql } = formatter.format(SelectQueryParser.parse('select * from users where active = true'));
```
Related tests: packages/core/tests/transformers/CommentStyle.comprehensive.test.ts

## Extends

- [`BaseFormattingOptions`](BaseFormattingOptions.md)

## Extended by

- [`CTEDecomposerOptions`](CTEDecomposerOptions.md)
- [`CTEComposerOptions`](CTEComposerOptions.md)

## Properties

### indentSize?

> `optional` **indentSize**: `number`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:39](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L39)

Number of spaces for indentation

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`indentSize`](BaseFormattingOptions.md#indentsize)

***

### indentChar?

> `optional` **indentChar**: `string`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:41](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L41)

Character to use for indentation ('space' or 'tab')

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`indentChar`](BaseFormattingOptions.md#indentchar)

***

### newline?

> `optional` **newline**: `NewlineOption`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:43](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L43)

Newline character style

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`newline`](BaseFormattingOptions.md#newline)

***

### keywordCase?

> `optional` **keywordCase**: `"none"` \| `"upper"` \| `"lower"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:45](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L45)

Case transformation for SQL keywords

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`keywordCase`](BaseFormattingOptions.md#keywordcase)

***

### commaBreak?

> `optional` **commaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:47](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L47)

Style for comma line breaks

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`commaBreak`](BaseFormattingOptions.md#commabreak)

***

### cteCommaBreak?

> `optional` **cteCommaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:49](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L49)

Style for comma line breaks inside WITH clause definitions

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`cteCommaBreak`](BaseFormattingOptions.md#ctecommabreak)

***

### andBreak?

> `optional` **andBreak**: `AndBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:51](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L51)

Style for AND/OR line breaks

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`andBreak`](BaseFormattingOptions.md#andbreak)

***

### exportComment?

> `optional` **exportComment**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:53](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L53)

Whether to export comments in formatted output

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`exportComment`](BaseFormattingOptions.md#exportcomment)

***

### strictCommentPlacement?

> `optional` **strictCommentPlacement**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:55](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L55)

Whether to only export comments from clause-level keywords

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`strictCommentPlacement`](BaseFormattingOptions.md#strictcommentplacement)

***

### commentStyle?

> `optional` **commentStyle**: [`CommentStyle`](../type-aliases/CommentStyle.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:57](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L57)

Comment formatting style

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`commentStyle`](BaseFormattingOptions.md#commentstyle)

***

### withClauseStyle?

> `optional` **withClauseStyle**: [`WithClauseStyle`](../type-aliases/WithClauseStyle.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:59](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L59)

Formatting style for WITH clauses

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`withClauseStyle`](BaseFormattingOptions.md#withclausestyle)

***

### parenthesesOneLine?

> `optional` **parenthesesOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:61](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L61)

Keep parentheses content on one line regardless of AND/OR break settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`parenthesesOneLine`](BaseFormattingOptions.md#parenthesesoneline)

***

### betweenOneLine?

> `optional` **betweenOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:63](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L63)

Keep BETWEEN expressions on one line regardless of AND break settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`betweenOneLine`](BaseFormattingOptions.md#betweenoneline)

***

### valuesOneLine?

> `optional` **valuesOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:65](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L65)

Keep VALUES clause on one line regardless of comma break settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`valuesOneLine`](BaseFormattingOptions.md#valuesoneline)

***

### joinOneLine?

> `optional` **joinOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:67](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L67)

Keep JOIN conditions on one line regardless of AND/OR break settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`joinOneLine`](BaseFormattingOptions.md#joinoneline)

***

### caseOneLine?

> `optional` **caseOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:69](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L69)

Keep CASE expressions on one line regardless of formatting settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`caseOneLine`](BaseFormattingOptions.md#caseoneline)

***

### subqueryOneLine?

> `optional` **subqueryOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:71](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L71)

Keep subqueries (inline queries) on one line regardless of formatting settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`subqueryOneLine`](BaseFormattingOptions.md#subqueryoneline)

***

### preset?

> `optional` **preset**: `"mysql"` \| `"postgres"` \| `"sqlserver"` \| `"sqlite"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:87](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L87)

Database preset for formatting style ('mysql', 'postgres', 'sqlserver', 'sqlite')

***

### identifierEscape?

> `optional` **identifierEscape**: `object`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:89](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L89)

Custom identifier escape characters (e.g., {start: '"', end: '"'} for PostgreSQL)

#### start

> **start**: `string`

#### end

> **end**: `string`

***

### parameterSymbol?

> `optional` **parameterSymbol**: `string` \| \{ `start`: `string`; `end`: `string`; \}

Defined in: [packages/core/src/transformers/SqlFormatter.ts:91](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L91)

Parameter symbol configuration for SQL parameters

***

### parameterStyle?

> `optional` **parameterStyle**: `"named"` \| `"indexed"` \| `"anonymous"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:93](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L93)

Style for parameter formatting
</div>
