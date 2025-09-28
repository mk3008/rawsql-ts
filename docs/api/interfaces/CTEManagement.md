<div v-pre>
# Interface: CTEManagement

Defined in: [packages/core/src/models/SelectQuery.ts:32](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SelectQuery.ts#L32)

Fluent API for managing Common Table Expressions on a select query.

Implementations are expected to surface the same error behaviour exercised in
packages/core/tests/models/SelectQuery.cte-management.test.ts.

## Methods

### addCTE()

> **addCTE**(`name`, `query`, `options?`): `this`

Defined in: [packages/core/src/models/SelectQuery.ts:33](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SelectQuery.ts#L33)

#### Parameters

##### name

`string`

##### query

[`SelectQuery`](SelectQuery.md)

##### options?

[`CTEOptions`](CTEOptions.md)

#### Returns

`this`

***

### removeCTE()

> **removeCTE**(`name`): `this`

Defined in: [packages/core/src/models/SelectQuery.ts:34](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SelectQuery.ts#L34)

#### Parameters

##### name

`string`

#### Returns

`this`

***

### hasCTE()

> **hasCTE**(`name`): `boolean`

Defined in: [packages/core/src/models/SelectQuery.ts:35](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SelectQuery.ts#L35)

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### getCTENames()

> **getCTENames**(): `string`[]

Defined in: [packages/core/src/models/SelectQuery.ts:36](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SelectQuery.ts#L36)

#### Returns

`string`[]

***

### replaceCTE()

> **replaceCTE**(`name`, `query`, `options?`): `this`

Defined in: [packages/core/src/models/SelectQuery.ts:37](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/models/SelectQuery.ts#L37)

#### Parameters

##### name

`string`

##### query

[`SelectQuery`](SelectQuery.md)

##### options?

[`CTEOptions`](CTEOptions.md)

#### Returns

`this`
</div>
