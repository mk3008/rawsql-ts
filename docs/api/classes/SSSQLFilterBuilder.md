<div v-pre>
# Class: SSSQLFilterBuilder

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:132](https://github.com/mk3008/rawsql-ts/blob/4a96cf12a5c3e5c2ca1c2e1e88ff01abcf60f29c/packages/core/src/transformers/SSSQLFilterBuilder.ts#L132)

Builds and refreshes truthful SSSQL optional filter branches.
Runtime callers should use pruning, not dynamic predicate injection.

## Constructors

### Constructor

> **new SSSQLFilterBuilder**(`tableColumnResolver?`): `SSSQLFilterBuilder`

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:135](https://github.com/mk3008/rawsql-ts/blob/4a96cf12a5c3e5c2ca1c2e1e88ff01abcf60f29c/packages/core/src/transformers/SSSQLFilterBuilder.ts#L135)

#### Parameters

##### tableColumnResolver?

(`tableName`) => `string`[]

#### Returns

`SSSQLFilterBuilder`

## Methods

### scaffold()

> **scaffold**(`query`, `filters`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:139](https://github.com/mk3008/rawsql-ts/blob/4a96cf12a5c3e5c2ca1c2e1e88ff01abcf60f29c/packages/core/src/transformers/SSSQLFilterBuilder.ts#L139)

#### Parameters

##### query

`string` | [`SelectQuery`](../interfaces/SelectQuery.md)

##### filters

[`SSSQLFilterInput`](../type-aliases/SSSQLFilterInput.md)

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

***

### refresh()

> **refresh**(`query`, `filters`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:156](https://github.com/mk3008/rawsql-ts/blob/4a96cf12a5c3e5c2ca1c2e1e88ff01abcf60f29c/packages/core/src/transformers/SSSQLFilterBuilder.ts#L156)

#### Parameters

##### query

`string` | [`SelectQuery`](../interfaces/SelectQuery.md)

##### filters

[`SSSQLFilterInput`](../type-aliases/SSSQLFilterInput.md)

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
