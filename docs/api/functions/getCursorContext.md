<div v-pre>
# Function: getCursorContext()

> **getCursorContext**(`sql`, `cursorPosition`): [`IntelliSenseContext`](../interfaces/IntelliSenseContext.md)

Defined in: [packages/core/src/utils/IntelliSenseApi.ts:68](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/utils/IntelliSenseApi.ts#L68)

Analyze cursor context for IntelliSense completion suggestions

Determines what type of completions should be offered at the cursor position
based on SQL syntax context (SELECT clause, WHERE condition, etc.).

## Parameters

### sql

`string`

SQL text to analyze

### cursorPosition

Cursor position (character offset or line/column)

`number` | [`LineColumn`](../interfaces/LineColumn.md)

## Returns

[`IntelliSenseContext`](../interfaces/IntelliSenseContext.md)

Cursor context information for completion logic
</div>
