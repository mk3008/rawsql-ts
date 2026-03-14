<div v-pre>
# Interface: FilterConditionObject

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:42](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L42)

Object-form filter condition supporting scalar operators, logical grouping,
and column-anchored EXISTS/NOT EXISTS predicates.

## Example

```ts
const filter: FilterConditionObject = {
  min: 10,
  max: 100,
  exists: { sql: 'SELECT 1 FROM orders WHERE user_id = $c0' }
};
Related tests: packages/core/tests/transformers/DynamicQueryBuilder.test.ts
```

## Properties

### min?

> `optional` **min**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:43](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L43)

***

### max?

> `optional` **max**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:44](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L44)

***

### like?

> `optional` **like**: `string`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:45](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L45)

***

### ilike?

> `optional` **ilike**: `string`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:46](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L46)

***

### in?

> `optional` **in**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:47](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L47)

***

### any?

> `optional` **any**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:48](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L48)

***

### =?

> `optional` **=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:49](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L49)

***

### \>?

> `optional` **\>**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:50](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L50)

***

### \<?

> `optional` **\<**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:51](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L51)

***

### \>=?

> `optional` **\>=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:52](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L52)

***

### \<=?

> `optional` **\<=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:53](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L53)

***

### !=?

> `optional` **!=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:54](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L54)

***

### &lt;\&gt;?

> `optional` **&lt;\&gt;**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:55](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L55)

***

### or?

> `optional` **or**: `object`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:56](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L56)

#### Index Signature

\[`operator`: `string`\]: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

#### column

> **column**: `string`

***

### and?

> `optional` **and**: `object`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:57](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L57)

#### Index Signature

\[`operator`: `string`\]: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

#### column

> **column**: `string`

***

### column?

> `optional` **column**: `string`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:59](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L59)

***

### exists?

> `optional` **exists**: [`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:60](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L60)

***

### notExists?

> `optional` **notExists**: [`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:61](https://github.com/mk3008/rawsql-ts/blob/9a1f2fe06729665247044262e9b171d6b0348aaa/packages/core/src/transformers/DynamicQueryBuilder.ts#L61)
</div>
