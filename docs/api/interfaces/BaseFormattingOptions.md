<div v-pre>
# Interface: BaseFormattingOptions

Defined in: [packages/core/src/transformers/SqlFormatter.ts:37](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L37)

Common formatting knobs shared by SqlFormatter and SqlPrinter.

## Example

```typescript
const formatter = new SqlFormatter({ keywordCase: 'upper', indentSize: 4 });
const { formattedSql } = formatter.format(SelectQueryParser.parse('select * from users'));
```
Related tests: packages/core/tests/transformers/SqlFormatter.case.test.ts

## Extended by

- [`SqlFormatterOptions`](SqlFormatterOptions.md)

## Properties

### indentSize?

> `optional` **indentSize**: `number`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:39](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L39)

Number of spaces for indentation

***

### indentChar?

> `optional` **indentChar**: `string`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:41](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L41)

Character to use for indentation ('space' or 'tab')

***

### newline?

> `optional` **newline**: `NewlineOption`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:43](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L43)

Newline character style

***

### keywordCase?

> `optional` **keywordCase**: `"none"` \| `"upper"` \| `"lower"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:45](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L45)

Case transformation for SQL keywords

***

### commaBreak?

> `optional` **commaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:47](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L47)

Style for comma line breaks

***

### cteCommaBreak?

> `optional` **cteCommaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:49](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L49)

Style for comma line breaks inside WITH clause definitions

***

### andBreak?

> `optional` **andBreak**: `AndBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:51](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L51)

Style for AND/OR line breaks

***

### exportComment?

> `optional` **exportComment**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:53](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L53)

Whether to export comments in formatted output

***

### strictCommentPlacement?

> `optional` **strictCommentPlacement**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:55](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L55)

Whether to only export comments from clause-level keywords

***

### commentStyle?

> `optional` **commentStyle**: [`CommentStyle`](../type-aliases/CommentStyle.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:57](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L57)

Comment formatting style

***

### withClauseStyle?

> `optional` **withClauseStyle**: [`WithClauseStyle`](../type-aliases/WithClauseStyle.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:59](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L59)

Formatting style for WITH clauses

***

### parenthesesOneLine?

> `optional` **parenthesesOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:61](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L61)

Keep parentheses content on one line regardless of AND/OR break settings

***

### betweenOneLine?

> `optional` **betweenOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:63](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L63)

Keep BETWEEN expressions on one line regardless of AND break settings

***

### valuesOneLine?

> `optional` **valuesOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:65](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L65)

Keep VALUES clause on one line regardless of comma break settings

***

### joinOneLine?

> `optional` **joinOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:67](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L67)

Keep JOIN conditions on one line regardless of AND/OR break settings

***

### caseOneLine?

> `optional` **caseOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:69](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L69)

Keep CASE expressions on one line regardless of formatting settings

***

### subqueryOneLine?

> `optional` **subqueryOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:71](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlFormatter.ts#L71)

Keep subqueries (inline queries) on one line regardless of formatting settings
</div>
