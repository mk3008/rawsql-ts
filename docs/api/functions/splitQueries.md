<div v-pre>
# Function: splitQueries()

> **splitQueries**(`sql`): [`QueryCollection`](../interfaces/QueryCollection.md)

Defined in: [packages/core/src/utils/IntelliSenseApi.ts:109](https://github.com/mk3008/rawsql-ts/blob/d05c323631d1c06a7d31e973b82bbb5e6eed5b3a/packages/core/src/utils/IntelliSenseApi.ts#L109)

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
