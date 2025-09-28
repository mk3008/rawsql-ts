<div v-pre>
# Function: splitQueries()

> **splitQueries**(`sql`): [`QueryCollection`](../interfaces/QueryCollection.md)

Defined in: [packages/core/src/utils/IntelliSenseApi.ts:109](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/IntelliSenseApi.ts#L109)

Split multi-query SQL text into individual queries

Handles SQL editors that contain multiple statements separated by semicolons.
Properly handles string literals and comments containing semicolons.

## Parameters

### sql

`string`

Multi-query SQL text

## Returns

[`QueryCollection`](../interfaces/QueryCollection.md)

Collection of individual queries with position information
</div>
