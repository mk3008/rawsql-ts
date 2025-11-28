<div v-pre>
# Interface: ScopeInfo

Defined in: [packages/core/src/utils/ScopeResolver.ts:63](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/utils/ScopeResolver.ts#L63)

Complete scope information at a cursor position

## Properties

### availableTables

> **availableTables**: [`AvailableTable`](AvailableTable.md)[]

Defined in: [packages/core/src/utils/ScopeResolver.ts:65](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/utils/ScopeResolver.ts#L65)

Tables available at the current position

***

### availableCTEs

> **availableCTEs**: [`AvailableCTE`](AvailableCTE.md)[]

Defined in: [packages/core/src/utils/ScopeResolver.ts:67](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/utils/ScopeResolver.ts#L67)

CTEs available at the current position

***

### subqueryLevel

> **subqueryLevel**: `number`

Defined in: [packages/core/src/utils/ScopeResolver.ts:69](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/utils/ScopeResolver.ts#L69)

Nesting level (0 = root query)

***

### visibleColumns

> **visibleColumns**: [`AvailableColumn`](AvailableColumn.md)[]

Defined in: [packages/core/src/utils/ScopeResolver.ts:71](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/utils/ScopeResolver.ts#L71)

Columns visible from all tables in scope

***

### currentQuery?

> `optional` **currentQuery**: [`SelectQuery`](SelectQuery.md)

Defined in: [packages/core/src/utils/ScopeResolver.ts:73](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/utils/ScopeResolver.ts#L73)

Current query being analyzed

***

### parentQueries

> **parentQueries**: [`SelectQuery`](SelectQuery.md)[]

Defined in: [packages/core/src/utils/ScopeResolver.ts:75](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/utils/ScopeResolver.ts#L75)

Parent queries (for nested contexts)
</div>
