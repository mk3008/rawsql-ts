<div v-pre>
# Interface: AvailableCTE

Defined in: [packages/core/src/utils/ScopeResolver.ts:31](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/utils/ScopeResolver.ts#L31)

Information about a CTE available in the current scope

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:33](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/utils/ScopeResolver.ts#L33)

CTE name

***

### columns?

> `optional` **columns**: `string`[]

Defined in: [packages/core/src/utils/ScopeResolver.ts:35](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/utils/ScopeResolver.ts#L35)

Column names if determinable

***

### query

> **query**: [`SelectQuery`](SelectQuery.md)

Defined in: [packages/core/src/utils/ScopeResolver.ts:37](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/utils/ScopeResolver.ts#L37)

The CTE query definition

***

### materialized?

> `optional` **materialized**: `boolean`

Defined in: [packages/core/src/utils/ScopeResolver.ts:39](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/utils/ScopeResolver.ts#L39)

Whether the CTE is materialized
</div>
