<div v-pre>
# Function: getIntelliSenseInfo()

> **getIntelliSenseInfo**(`sql`, `cursorPosition`, `options`): `undefined` \| \{ `context`: [`IntelliSenseContext`](../interfaces/IntelliSenseContext.md); `scope`: [`ScopeInfo`](../interfaces/ScopeInfo.md); `parseResult`: [`PositionParseResult`](../interfaces/PositionParseResult.md); `currentQuery`: `string`; `relativePosition`: `number`; \}

Defined in: [packages/core/src/utils/IntelliSenseApi.ts:124](https://github.com/mk3008/rawsql-ts/blob/92142303681e2096368e1351195d7eb6b51f472b/packages/core/src/utils/IntelliSenseApi.ts#L124)

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

`undefined` \| \{ `context`: [`IntelliSenseContext`](../interfaces/IntelliSenseContext.md); `scope`: [`ScopeInfo`](../interfaces/ScopeInfo.md); `parseResult`: [`PositionParseResult`](../interfaces/PositionParseResult.md); `currentQuery`: `string`; `relativePosition`: `number`; \}

Complete IntelliSense information or undefined if position is invalid
</div>
