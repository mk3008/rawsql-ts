<div v-pre>
# Interface: ExistsSubqueryDefinition

Defined in: [packages/core/src/transformers/ExistsPredicateInjector.ts:40](https://github.com/mk3008/rawsql-ts/blob/91d42e83cf18d5aa89f15811c30826dcf6b4e437/packages/core/src/transformers/ExistsPredicateInjector.ts#L40)

Describes a correlated subquery that renders an EXISTS/NOT EXISTS predicate.

## Extended by

- [`MultiColumnExistsDefinition`](MultiColumnExistsDefinition.md)

## Properties

### sql

> **sql**: `string`

Defined in: [packages/core/src/transformers/ExistsPredicateInjector.ts:42](https://github.com/mk3008/rawsql-ts/blob/91d42e83cf18d5aa89f15811c30826dcf6b4e437/packages/core/src/transformers/ExistsPredicateInjector.ts#L42)

SQL that references the `$c#` placeholders for the anchor columns.

***

### params?

> `optional` **params**: `Record`&lt;`string`, [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)\&gt;

Defined in: [packages/core/src/transformers/ExistsPredicateInjector.ts:44](https://github.com/mk3008/rawsql-ts/blob/91d42e83cf18d5aa89f15811c30826dcf6b4e437/packages/core/src/transformers/ExistsPredicateInjector.ts#L44)

Optional named parameters that the subquery requires.
</div>
