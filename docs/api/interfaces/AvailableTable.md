<div v-pre>
# Interface: AvailableTable

Defined in: [packages/core/src/utils/ScopeResolver.ts:14](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/utils/ScopeResolver.ts#L14)

Information about a table available in the current scope

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:16](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/utils/ScopeResolver.ts#L16)

Table name (unqualified)

***

### alias?

> `optional` **alias**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:18](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/utils/ScopeResolver.ts#L18)

Table alias (if any)

***

### schema?

> `optional` **schema**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:20](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/utils/ScopeResolver.ts#L20)

Schema name (if qualified)

***

### fullName

> **fullName**: `string`

Defined in: [packages/core/src/utils/ScopeResolver.ts:22](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/utils/ScopeResolver.ts#L22)

Full qualified name

***

### sourceType

> **sourceType**: `"table"` \| `"cte"` \| `"subquery"`

Defined in: [packages/core/src/utils/ScopeResolver.ts:24](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/utils/ScopeResolver.ts#L24)

Source type: 'table', 'cte', 'subquery'

***

### originalQuery?

> `optional` **originalQuery**: [`SelectQuery`](SelectQuery.md)

Defined in: [packages/core/src/utils/ScopeResolver.ts:26](https://github.com/mk3008/rawsql-ts/blob/de060eb277dbae69467affb854aff63649885052/packages/core/src/utils/ScopeResolver.ts#L26)

Original table reference for subqueries
</div>
