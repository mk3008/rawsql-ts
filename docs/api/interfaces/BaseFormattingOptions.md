<div v-pre>
# Interface: BaseFormattingOptions

Defined in: [packages/core/src/transformers/SqlFormatter.ts:39](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L39)

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

Defined in: [packages/core/src/transformers/SqlFormatter.ts:41](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L41)

Number of spaces for indentation

***

### indentChar?

> `optional` **indentChar**: `string`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:43](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L43)

Character to use for indentation (logical 'space'/'tab' or literal control character)

***

### newline?

> `optional` **newline**: `NewlineOption`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:45](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L45)

Newline character style (logical 'lf'/'crlf'/'cr' or literal newline string)

***

### keywordCase?

> `optional` **keywordCase**: `"none"` \| `"upper"` \| `"lower"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:47](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L47)

Case transformation for SQL keywords

***

### commaBreak?

> `optional` **commaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:49](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L49)

Style for comma line breaks

***

### cteCommaBreak?

> `optional` **cteCommaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:51](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L51)

Style for comma line breaks inside WITH clause definitions

***

### valuesCommaBreak?

> `optional` **valuesCommaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:53](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L53)

Style for comma line breaks inside VALUES clauses

***

### andBreak?

> `optional` **andBreak**: `AndBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:55](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L55)

Style for AND line breaks

***

### orBreak?

> `optional` **orBreak**: `OrBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:57](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L57)

Style for OR line breaks

***

### exportComment?

> `optional` **exportComment**: `boolean` \| [`CommentExportMode`](../type-aliases/CommentExportMode.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:59](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L59)

Whether to export comments in formatted output

***

### commentStyle?

> `optional` **commentStyle**: [`CommentStyle`](../type-aliases/CommentStyle.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:61](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L61)

Comment formatting style

***

### withClauseStyle?

> `optional` **withClauseStyle**: [`WithClauseStyle`](../type-aliases/WithClauseStyle.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:63](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L63)

Formatting style for WITH clauses

***

### parenthesesOneLine?

> `optional` **parenthesesOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:65](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L65)

Keep parentheses content on one line regardless of AND/OR break settings

***

### betweenOneLine?

> `optional` **betweenOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:67](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L67)

Keep BETWEEN expressions on one line regardless of AND break settings

***

### valuesOneLine?

> `optional` **valuesOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:69](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L69)

Keep VALUES clause on one line regardless of comma break settings

***

### joinOneLine?

> `optional` **joinOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:71](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L71)

Keep JOIN conditions on one line regardless of AND/OR break settings

***

### caseOneLine?

> `optional` **caseOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:73](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L73)

Keep CASE expressions on one line regardless of formatting settings

***

### subqueryOneLine?

> `optional` **subqueryOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:75](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L75)

Keep subqueries (inline queries) on one line regardless of formatting settings

***

### indentNestedParentheses?

> `optional` **indentNestedParentheses**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:77](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L77)

Indent nested parentheses when boolean groups contain additional parentheses

***

### insertColumnsOneLine?

> `optional` **insertColumnsOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:79](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L79)

Keep INSERT column lists on one line regardless of comma break settings

***

### whenOneLine?

> `optional` **whenOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:81](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L81)

Keep MERGE WHEN clause predicates on one line regardless of AND break settings

***

### joinConditionOrderByDeclaration?

> `optional` **joinConditionOrderByDeclaration**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:83](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SqlFormatter.ts#L83)

Reorder JOIN ON column comparisons to follow table declaration order
</div>
