<div v-pre>
# Interface: MultiColumnExistsDefinition

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:59](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/DynamicQueryBuilder.ts#L59)

Describes a correlated subquery that renders an EXISTS/NOT EXISTS predicate.

## Extends

- [`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md)

## Properties

### on

> **on**: `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:60](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/DynamicQueryBuilder.ts#L60)

***

### sql

> **sql**: `string`

Defined in: [packages/core/src/transformers/ExistsPredicateInjector.ts:42](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/ExistsPredicateInjector.ts#L42)

SQL that references the `$c#` placeholders for the anchor columns.

#### Inherited from

[`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md).[`sql`](ExistsSubqueryDefinition.md#sql)

***

### params?

> `optional` **params**: `Record`&lt;`string`, [`SqlParameterValue`](../type-aliases/SqlParameterValue.md)\&gt;

Defined in: [packages/core/src/transformers/ExistsPredicateInjector.ts:44](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/ExistsPredicateInjector.ts#L44)

Optional named parameters that the subquery requires.

#### Inherited from

[`ExistsSubqueryDefinition`](ExistsSubqueryDefinition.md).[`params`](ExistsSubqueryDefinition.md#params)
</div>
