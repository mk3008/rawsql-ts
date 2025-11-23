<div v-pre>
# Function: splitQueries()

> **splitQueries**(`sql`): [`QueryCollection`](../interfaces/QueryCollection.md)

Defined in: [packages/core/src/utils/IntelliSenseApi.ts:109](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/utils/IntelliSenseApi.ts#L109)

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
