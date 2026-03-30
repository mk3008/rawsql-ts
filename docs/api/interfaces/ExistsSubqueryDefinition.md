<div v-pre>
# Interface: ExistsSubqueryDefinition

Defined in: [packages/core/src/transformers/ExistsPredicateInjector.ts:40](https://github.com/mk3008/rawsql-ts/blob/15281f90ed1573f1c4d35f7aeeb5e5a04cc184e7/packages/core/src/transformers/ExistsPredicateInjector.ts#L40)

Describes a correlated subquery that renders an EXISTS/NOT EXISTS predicate.

## Extended by

- [`MultiColumnExistsDefinition`](MultiColumnExistsDefinition.md)

## Properties

### sql

> **sql**: `string`

Defined in: [packages/core/src/transformers/ExistsPredicateInjector.ts:42](https://github.com/mk3008/rawsql-ts/blob/15281f90ed1573f1c4d35f7aeeb5e5a04cc184e7/packages/core/src/transformers/ExistsPredicateInjector.ts#L42)

SQL that references the `$c#` placeholders for the anchor columns.

***

### params?

> `optional` **params**: `Record`&lt;`string`, [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)\&gt;

Defined in: [packages/core/src/transformers/ExistsPredicateInjector.ts:44](https://github.com/mk3008/rawsql-ts/blob/15281f90ed1573f1c4d35f7aeeb5e5a04cc184e7/packages/core/src/transformers/ExistsPredicateInjector.ts#L44)

Optional named parameters that the subquery requires.
</div>
