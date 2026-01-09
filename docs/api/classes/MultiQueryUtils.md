<div v-pre>
# Class: MultiQueryUtils

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:344](https://github.com/mk3008/rawsql-ts/blob/91d42e83cf18d5aa89f15811c30826dcf6b4e437/packages/core/src/utils/MultiQuerySplitter.ts#L344)

Utility functions for working with query collections

## Constructors

### Constructor

> **new MultiQueryUtils**(): `MultiQueryUtils`

#### Returns

`MultiQueryUtils`

## Methods

### getContextAt()

> `static` **getContextAt**(`text`, `cursorPosition`): `undefined` \| \{ `query`: [`QueryInfo`](../interfaces/QueryInfo.md); `relativePosition`: `number`; \}

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:352](https://github.com/mk3008/rawsql-ts/blob/91d42e83cf18d5aa89f15811c30826dcf6b4e437/packages/core/src/utils/MultiQuerySplitter.ts#L352)

Get context information for IntelliSense at a cursor position

#### Parameters

##### text

`string`

Multi-query SQL text

##### cursorPosition

Cursor position

`number` | [`LineColumn`](../interfaces/LineColumn.md)

#### Returns

`undefined` \| \{ `query`: [`QueryInfo`](../interfaces/QueryInfo.md); `relativePosition`: `number`; \}

Active query and position within that query

***

### extractQueries()

> `static` **extractQueries**(`text`): `string`[]

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:378](https://github.com/mk3008/rawsql-ts/blob/91d42e83cf18d5aa89f15811c30826dcf6b4e437/packages/core/src/utils/MultiQuerySplitter.ts#L378)

Extract all non-empty queries from multi-query text

#### Parameters

##### text

`string`

Multi-query SQL text

#### Returns

`string`[]

Array of query SQL strings
</div>
