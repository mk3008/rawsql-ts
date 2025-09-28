<div v-pre>
# Function: resolveScope()

> **resolveScope**(`sql`, `cursorPosition`): [`ScopeInfo`](../interfaces/ScopeInfo.md)

Defined in: [packages/core/src/utils/IntelliSenseApi.ts:89](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/IntelliSenseApi.ts#L89)

Resolve scope information at cursor position

Provides comprehensive information about available tables, CTEs, and columns
at the specified cursor position for intelligent completion suggestions.

## Parameters

### sql

`string`

SQL text to analyze

### cursorPosition

Cursor position (character offset or line/column)

`number` | [`LineColumn`](../interfaces/LineColumn.md)

## Returns

[`ScopeInfo`](../interfaces/ScopeInfo.md)

Complete scope information including available tables and columns
</div>
