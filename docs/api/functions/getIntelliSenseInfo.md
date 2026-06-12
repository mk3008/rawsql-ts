<div v-pre>
# Function: getIntelliSenseInfo()

> **getIntelliSenseInfo**(`sql`, `cursorPosition`, `options`): \{ `context`: [`IntelliSenseContext`](../interfaces/IntelliSenseContext.md); `scope`: [`ScopeInfo`](../interfaces/ScopeInfo.md); `parseResult`: [`PositionParseResult`](../interfaces/PositionParseResult.md); `currentQuery`: `string`; `relativePosition`: `number`; \} \| `undefined`

Defined in: [packages/core/src/utils/IntelliSenseApi.ts:124](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/utils/IntelliSenseApi.ts#L124)

Get IntelliSense information for a cursor position in multi-query context

Combines query splitting, context analysis, and scope resolution to provide
complete IntelliSense information for a cursor position in multi-query SQL.

## Parameters

### sql

`string`

Multi-query SQL text

### cursorPosition

Cursor position

`number` | [`LineColumn`](../interfaces/LineColumn.md)

### options

[`ParseToPositionOptions`](../interfaces/ParseToPositionOptions.md) = `{}`

Parsing options

## Returns

\{ `context`: [`IntelliSenseContext`](../interfaces/IntelliSenseContext.md); `scope`: [`ScopeInfo`](../interfaces/ScopeInfo.md); `parseResult`: [`PositionParseResult`](../interfaces/PositionParseResult.md); `currentQuery`: `string`; `relativePosition`: `number`; \} \| `undefined`

Complete IntelliSense information or undefined if position is invalid
</div>
