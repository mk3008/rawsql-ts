<div v-pre>
# Interface: AvailableCTE

Defined in: [packages/core/src/utils/ScopeResolver.ts:32](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/utils/ScopeResolver.ts#L32)

Information about a CTE available in the current scope

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:34](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/utils/ScopeResolver.ts#L34)

CTE name

***

### columns?

> `optional` **columns**: `string`[]

Defined in: [packages/core/src/utils/ScopeResolver.ts:36](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/utils/ScopeResolver.ts#L36)

Column names if determinable

***

### query

> **query**: [`CTEQuery`](../type-aliases/CTEQuery.md)

Defined in: [packages/core/src/utils/ScopeResolver.ts:38](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/utils/ScopeResolver.ts#L38)

The CTE query definition (SELECT or writable DML with RETURNING)

***

### materialized?

> `optional` **materialized**: `boolean`

Defined in: [packages/core/src/utils/ScopeResolver.ts:40](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/utils/ScopeResolver.ts#L40)

Whether the CTE is materialized
</div>
