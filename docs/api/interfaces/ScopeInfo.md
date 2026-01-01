<div v-pre>
# Interface: ScopeInfo

Defined in: [packages/core/src/utils/ScopeResolver.ts:64](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/utils/ScopeResolver.ts#L64)

Complete scope information at a cursor position

## Properties

### availableTables

> **availableTables**: [`AvailableTable`](AvailableTable.md)[]

Defined in: [packages/core/src/utils/ScopeResolver.ts:66](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/utils/ScopeResolver.ts#L66)

Tables available at the current position

***

### availableCTEs

> **availableCTEs**: [`AvailableCTE`](AvailableCTE.md)[]

Defined in: [packages/core/src/utils/ScopeResolver.ts:68](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/utils/ScopeResolver.ts#L68)

CTEs available at the current position

***

### subqueryLevel

> **subqueryLevel**: `number`

Defined in: [packages/core/src/utils/ScopeResolver.ts:70](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/utils/ScopeResolver.ts#L70)

Nesting level (0 = root query)

***

### visibleColumns

> **visibleColumns**: [`AvailableColumn`](AvailableColumn.md)[]

Defined in: [packages/core/src/utils/ScopeResolver.ts:72](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/utils/ScopeResolver.ts#L72)

Columns visible from all tables in scope

***

### currentQuery?

> `optional` **currentQuery**: [`SelectQuery`](SelectQuery.md)

Defined in: [packages/core/src/utils/ScopeResolver.ts:74](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/utils/ScopeResolver.ts#L74)

Current query being analyzed

***

### parentQueries

> **parentQueries**: [`SelectQuery`](SelectQuery.md)[]

Defined in: [packages/core/src/utils/ScopeResolver.ts:76](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/utils/ScopeResolver.ts#L76)

Parent queries (for nested contexts)
</div>
