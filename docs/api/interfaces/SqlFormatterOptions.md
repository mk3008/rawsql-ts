<div v-pre>
# Interface: SqlFormatterOptions

Defined in: [packages/core/src/transformers/SqlFormatter.ts:97](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L97)

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

Defined in: [packages/core/src/transformers/SqlFormatter.ts:41](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L41)

Number of spaces for indentation

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`indentSize`](BaseFormattingOptions.md#indentsize)

***

### indentChar?

> `optional` **indentChar**: `string`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:43](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L43)

Character to use for indentation (logical 'space'/'tab' or literal control character)

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`indentChar`](BaseFormattingOptions.md#indentchar)

***

### newline?

> `optional` **newline**: `NewlineOption`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:45](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L45)

Newline character style (logical 'lf'/'crlf'/'cr' or literal newline string)

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`newline`](BaseFormattingOptions.md#newline)

***

### keywordCase?

> `optional` **keywordCase**: `"none"` \| `"upper"` \| `"lower"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:47](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L47)

Case transformation for SQL keywords

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`keywordCase`](BaseFormattingOptions.md#keywordcase)

***

### commaBreak?

> `optional` **commaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:49](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L49)

Style for comma line breaks

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`commaBreak`](BaseFormattingOptions.md#commabreak)

***

### cteCommaBreak?

> `optional` **cteCommaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:51](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L51)

Style for comma line breaks inside WITH clause definitions

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`cteCommaBreak`](BaseFormattingOptions.md#ctecommabreak)

***

### valuesCommaBreak?

> `optional` **valuesCommaBreak**: `CommaBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:53](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L53)

Style for comma line breaks inside VALUES clauses

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`valuesCommaBreak`](BaseFormattingOptions.md#valuescommabreak)

***

### andBreak?

> `optional` **andBreak**: `AndBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:55](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L55)

Style for AND line breaks

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`andBreak`](BaseFormattingOptions.md#andbreak)

***

### orBreak?

> `optional` **orBreak**: `OrBreakStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:57](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L57)

Style for OR line breaks

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`orBreak`](BaseFormattingOptions.md#orbreak)

***

### exportComment?

> `optional` **exportComment**: `boolean` \| [`CommentExportMode`](../type-aliases/CommentExportMode.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:59](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L59)

Whether to export comments in formatted output

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`exportComment`](BaseFormattingOptions.md#exportcomment)

***

### commentStyle?

> `optional` **commentStyle**: [`CommentStyle`](../type-aliases/CommentStyle.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:61](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L61)

Comment formatting style

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`commentStyle`](BaseFormattingOptions.md#commentstyle)

***

### withClauseStyle?

> `optional` **withClauseStyle**: [`WithClauseStyle`](../type-aliases/WithClauseStyle.md)

Defined in: [packages/core/src/transformers/SqlFormatter.ts:63](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L63)

Formatting style for WITH clauses

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`withClauseStyle`](BaseFormattingOptions.md#withclausestyle)

***

### parenthesesOneLine?

> `optional` **parenthesesOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:65](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L65)

Keep parentheses content on one line regardless of AND/OR break settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`parenthesesOneLine`](BaseFormattingOptions.md#parenthesesoneline)

***

### betweenOneLine?

> `optional` **betweenOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:67](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L67)

Keep BETWEEN expressions on one line regardless of AND break settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`betweenOneLine`](BaseFormattingOptions.md#betweenoneline)

***

### valuesOneLine?

> `optional` **valuesOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:69](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L69)

Keep VALUES clause on one line regardless of comma break settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`valuesOneLine`](BaseFormattingOptions.md#valuesoneline)

***

### joinOneLine?

> `optional` **joinOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:71](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L71)

Keep JOIN conditions on one line regardless of AND/OR break settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`joinOneLine`](BaseFormattingOptions.md#joinoneline)

***

### caseOneLine?

> `optional` **caseOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:73](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L73)

Keep CASE expressions on one line regardless of formatting settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`caseOneLine`](BaseFormattingOptions.md#caseoneline)

***

### subqueryOneLine?

> `optional` **subqueryOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:75](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L75)

Keep subqueries (inline queries) on one line regardless of formatting settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`subqueryOneLine`](BaseFormattingOptions.md#subqueryoneline)

***

### indentNestedParentheses?

> `optional` **indentNestedParentheses**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:77](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L77)

Indent nested parentheses when boolean groups contain additional parentheses

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`indentNestedParentheses`](BaseFormattingOptions.md#indentnestedparentheses)

***

### insertColumnsOneLine?

> `optional` **insertColumnsOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:79](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L79)

Keep INSERT column lists on one line regardless of comma break settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`insertColumnsOneLine`](BaseFormattingOptions.md#insertcolumnsoneline)

***

### whenOneLine?

> `optional` **whenOneLine**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:81](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L81)

Keep MERGE WHEN clause predicates on one line regardless of AND break settings

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`whenOneLine`](BaseFormattingOptions.md#whenoneline)

***

### joinConditionOrderByDeclaration?

> `optional` **joinConditionOrderByDeclaration**: `boolean`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:83](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L83)

Reorder JOIN ON column comparisons to follow table declaration order

#### Inherited from

[`BaseFormattingOptions`](BaseFormattingOptions.md).[`joinConditionOrderByDeclaration`](BaseFormattingOptions.md#joinconditionorderbydeclaration)

***

### preset?

> `optional` **preset**: `"postgres"` \| `"mysql"` \| `"sqlserver"` \| `"sqlite"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:99](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L99)

Database preset for formatting style ('mysql', 'postgres', 'sqlserver', 'sqlite')

***

### identifierEscape?

> `optional` **identifierEscape**: `IdentifierEscapeOption`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:101](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L101)

Identifier escape style (logical name like 'quote' or explicit delimiters)

***

### parameterSymbol?

> `optional` **parameterSymbol**: `string` \| \{ `start`: `string`; `end`: `string`; \}

Defined in: [packages/core/src/transformers/SqlFormatter.ts:103](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L103)

Parameter symbol configuration for SQL parameters

***

### parameterStyle?

> `optional` **parameterStyle**: `"named"` \| `"indexed"` \| `"anonymous"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:105](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L105)

Style for parameter formatting

***

### castStyle?

> `optional` **castStyle**: `CastStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:107](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L107)

Preferred CAST rendering style

***

### constraintStyle?

> `optional` **constraintStyle**: `ConstraintStyle`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:109](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/SqlFormatter.ts#L109)

Constraint rendering style (affects CREATE TABLE constraint layout)
</div>
