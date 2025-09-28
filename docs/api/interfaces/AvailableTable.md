<div v-pre>
# Interface: AvailableTable

Defined in: [packages/core/src/utils/ScopeResolver.ts:13](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/ScopeResolver.ts#L13)

Information about a table available in the current scope

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:15](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/ScopeResolver.ts#L15)

Table name (unqualified)

***

### alias?

> `optional` **alias**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:17](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/ScopeResolver.ts#L17)

Table alias (if any)

***

### schema?

> `optional` **schema**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:19](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/ScopeResolver.ts#L19)

Schema name (if qualified)

***

### fullName

> **fullName**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:21](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/ScopeResolver.ts#L21)

Full qualified name

***

### sourceType

> **sourceType**: `"table"` \| `"cte"` \| `"subquery"`

Defined in: [packages/core/src/utils/ScopeResolver.ts:23](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/ScopeResolver.ts#L23)

Source type: 'table', 'cte', 'subquery'

***

### originalQuery?

> `optional` **originalQuery**: [`SelectQuery`](SelectQuery.md)

Defined in: [packages/core/src/utils/ScopeResolver.ts:25](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/ScopeResolver.ts#L25)

Original table reference for subqueries
</div>
