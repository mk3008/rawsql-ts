<div v-pre>
# Interface: MultiColumnExistsDefinition

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:64](https://github.com/mk3008/rawsql-ts/blob/6cdd42af781c619cdff6eec095b8bfd090dff85e/packages/core/src/transformers/DynamicQueryBuilder.ts#L64)

Describes a correlated subquery that renders an EXISTS/NOT EXISTS predicate.

## Extends

- [`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md)

## Properties

### on

> **on**: `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:65](https://github.com/mk3008/rawsql-ts/blob/6cdd42af781c619cdff6eec095b8bfd090dff85e/packages/core/src/transformers/DynamicQueryBuilder.ts#L65)

***

### sql

> **sql**: `string`

Defined in: [packages/core/src/transformers/ExistsPredicateInjector.ts:42](https://github.com/mk3008/rawsql-ts/blob/6cdd42af781c619cdff6eec095b8bfd090dff85e/packages/core/src/transformers/ExistsPredicateInjector.ts#L42)

SQL that references the `$c#` placeholders for the anchor columns.

#### Inherited from

[`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md).[`sql`](ExistsSubqueryDefinition.md#sql)

***

### params?

> `optional` **params**: `Record`&lt;`string`, [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)\&gt;

Defined in: [packages/core/src/transformers/ExistsPredicateInjector.ts:44](https://github.com/mk3008/rawsql-ts/blob/6cdd42af781c619cdff6eec095b8bfd090dff85e/packages/core/src/transformers/ExistsPredicateInjector.ts#L44)

Optional named parameters that the subquery requires.

#### Inherited from

[`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md).[`params`](ExistsSubqueryDefinition.md#params)
</div>
