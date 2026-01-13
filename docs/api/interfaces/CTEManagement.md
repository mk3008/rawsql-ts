<div v-pre>
# Interface: CTEManagement

Defined in: [packages/core/src/models/SelectQuery.ts:35](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/models/SelectQuery.ts#L35)

Fluent API for managing Common Table Expressions on a select query.

Implementations are expected to surface the same error behaviour exercised in
packages/core/tests/models/SelectQuery.cte-management.test.ts.

## Methods

### addCTE()

> **addCTE**(`name`, `query`, `options?`): `this`

Defined in: [packages/core/src/models/SelectQuery.ts:36](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/models/SelectQuery.ts#L36)

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

Defined in: [packages/core/src/models/SelectQuery.ts:37](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/models/SelectQuery.ts#L37)

#### Parameters

##### name

`string`

#### Returns

`this`

***

### hasCTE()

> **hasCTE**(`name`): `boolean`

Defined in: [packages/core/src/models/SelectQuery.ts:38](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/models/SelectQuery.ts#L38)

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### getCTENames()

> **getCTENames**(): `string`[]

Defined in: [packages/core/src/models/SelectQuery.ts:39](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/models/SelectQuery.ts#L39)

#### Returns

`string`[]

***

### replaceCTE()

> **replaceCTE**(`name`, `query`, `options?`): `this`

Defined in: [packages/core/src/models/SelectQuery.ts:40](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/models/SelectQuery.ts#L40)

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
