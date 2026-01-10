<div v-pre>
# Interface: FilterConditionObject

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:36](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L36)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:37](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L37)

***

### max?

> `optional` **max**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:38](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L38)

***

### like?

> `optional` **like**: `string`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:39](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L39)

***

### ilike?

> `optional` **ilike**: `string`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:40](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L40)

***

### in?

> `optional` **in**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:41](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L41)

***

### any?

> `optional` **any**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:42](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L42)

***

### =?

> `optional` **=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:43](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L43)

***

### \>?

> `optional` **\>**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:44](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L44)

***

### \<?

> `optional` **\<**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:45](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L45)

***

### \>=?

> `optional` **\>=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:46](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L46)

***

### \<=?

> `optional` **\<=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:47](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L47)

***

### !=?

> `optional` **!=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:48](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L48)

***

### &lt;\&gt;?

> `optional` **&lt;\&gt;**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:49](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L49)

***

### or?

> `optional` **or**: `object`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:50](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L50)

#### Index Signature

\[`operator`: `string`\]: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

#### column

> **column**: `string`

***

### and?

> `optional` **and**: `object`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:51](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L51)

#### Index Signature

\[`operator`: `string`\]: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

#### column

> **column**: `string`

***

### column?

> `optional` **column**: `string`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:53](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L53)

***

### exists?

> `optional` **exists**: [`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:54](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L54)

***

### notExists?

> `optional` **notExists**: [`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:55](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L55)
</div>
