<div v-pre>
# Interface: FilterConditionObject

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:32](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L32)

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

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:33](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L33)

***

### max?

> `optional` **max**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:34](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L34)

***

### like?

> `optional` **like**: `string`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:35](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L35)

***

### ilike?

> `optional` **ilike**: `string`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:36](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L36)

***

### in?

> `optional` **in**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:37](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L37)

***

### any?

> `optional` **any**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:38](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L38)

***

### =?

> `optional` **=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:39](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L39)

***

### \>?

> `optional` **\>**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:40](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L40)

***

### \<?

> `optional` **\<**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:41](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L41)

***

### \>=?

> `optional` **\>=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:42](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L42)

***

### \<=?

> `optional` **\<=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:43](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L43)

***

### !=?

> `optional` **!=**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:44](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L44)

***

### &lt;\&gt;?

> `optional` **&lt;\&gt;**: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:45](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L45)

***

### or?

> `optional` **or**: `object`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:46](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L46)

#### Index Signature

\[`operator`: `string`\]: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

#### column

> **column**: `string`

***

### and?

> `optional` **and**: `object`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:47](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L47)

#### Index Signature

\[`operator`: `string`\]: [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)

#### column

> **column**: `string`

***

### column?

> `optional` **column**: `string`

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:49](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L49)

***

### exists?

> `optional` **exists**: [`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:50](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L50)

***

### notExists?

> `optional` **notExists**: [`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:51](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/DynamicQueryBuilder.ts#L51)
</div>
