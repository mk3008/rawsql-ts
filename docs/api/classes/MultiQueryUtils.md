<div v-pre>
# Class: MultiQueryUtils

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:381](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/MultiQuerySplitter.ts#L381)

Utility functions for working with query collections

## Constructors

### Constructor

> **new MultiQueryUtils**(): `MultiQueryUtils`

#### Returns

`MultiQueryUtils`

## Methods

### getContextAt()

> `static` **getContextAt**(`text`, `cursorPosition`): \{ `query`: [`QueryInfo`](../interfaces/QueryInfo.md); `relativePosition`: `number`; \} \| `undefined`

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:389](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/MultiQuerySplitter.ts#L389)

Get context information for IntelliSense at a cursor position

#### Parameters

##### text

`string`

Multi-query SQL text

##### cursorPosition

Cursor position

`number` | [`LineColumn`](../interfaces/LineColumn.md)

#### Returns

\{ `query`: [`QueryInfo`](../interfaces/QueryInfo.md); `relativePosition`: `number`; \} \| `undefined`

Active query and position within that query

***

### extractQueries()

> `static` **extractQueries**(`text`): `string`[]

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:415](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/MultiQuerySplitter.ts#L415)

Extract all non-empty queries from multi-query text

#### Parameters

##### text

`string`

Multi-query SQL text

#### Returns

`string`[]

Array of query SQL strings
</div>
