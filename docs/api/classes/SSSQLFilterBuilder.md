<div v-pre>
# Class: SSSQLFilterBuilder

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:532](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/SSSQLFilterBuilder.ts#L532)

Builds and refreshes truthful SSSQL optional filter branches.
Runtime callers should use pruning, not dynamic predicate injection.

## Constructors

### Constructor

> **new SSSQLFilterBuilder**(`tableColumnResolver?`): `SSSQLFilterBuilder`

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:535](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/SSSQLFilterBuilder.ts#L535)

#### Parameters

##### tableColumnResolver?

(`tableName`) => `string`[]

#### Returns

`SSSQLFilterBuilder`

## Methods

### list()

> **list**(`query`): [`SssqlBranchInfo`](../interfaces/SssqlBranchInfo.md)[]

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:539](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/SSSQLFilterBuilder.ts#L539)

#### Parameters

##### query

`string` | [`SelectQuery`](../interfaces/SelectQuery.md)

#### Returns

[`SssqlBranchInfo`](../interfaces/SssqlBranchInfo.md)[]

***

### scaffold()

> **scaffold**(`query`, `filters`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:544](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/SSSQLFilterBuilder.ts#L544)

#### Parameters

##### query

`string` | [`SelectQuery`](../interfaces/SelectQuery.md)

##### filters

[`SSSQLFilterInput`](../type-aliases/SSSQLFilterInput.md)

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

***

### scaffoldBranch()

> **scaffoldBranch**(`query`, `spec`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:564](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/SSSQLFilterBuilder.ts#L564)

#### Parameters

##### query

`string` | [`SelectQuery`](../interfaces/SelectQuery.md)

##### spec

[`SssqlScaffoldSpec`](../type-aliases/SssqlScaffoldSpec.md)

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

***

### refresh()

> **refresh**(`query`, `filters`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:576](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/SSSQLFilterBuilder.ts#L576)

#### Parameters

##### query

`string` | [`SelectQuery`](../interfaces/SelectQuery.md)

##### filters

[`SSSQLFilterInput`](../type-aliases/SSSQLFilterInput.md)

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

***

### remove()

> **remove**(`query`, `spec`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:645](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/SSSQLFilterBuilder.ts#L645)

#### Parameters

##### query

`string` | [`SelectQuery`](../interfaces/SelectQuery.md)

##### spec

[`SssqlRemoveSpec`](../interfaces/SssqlRemoveSpec.md)

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

***

### removeAll()

> **removeAll**(`query`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/SSSQLFilterBuilder.ts:666](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/SSSQLFilterBuilder.ts#L666)

#### Parameters

##### query

`string` | [`SelectQuery`](../interfaces/SelectQuery.md)

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)
</div>
