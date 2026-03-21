<div v-pre>
# Function: getCursorContext()

> **getCursorContext**(`sql`, `cursorPosition`): [`IntelliSenseContext`](../interfaces/IntelliSenseContext.md)

Defined in: [packages/core/src/utils/IntelliSenseApi.ts:68](https://github.com/mk3008/rawsql-ts/blob/955e84e7de04fba60ecd2103c7f0ef97b23ed887/packages/core/src/utils/IntelliSenseApi.ts#L68)

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
