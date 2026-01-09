<div v-pre>
# Function: parseToPosition()

> **parseToPosition**(`sql`, `cursorPosition`, `options`): [`PositionParseResult`](../interfaces/PositionParseResult.md)

Defined in: [packages/core/src/utils/IntelliSenseApi.ts:50](https://github.com/mk3008/rawsql-ts/blob/91d42e83cf18d5aa89f15811c30826dcf6b4e437/packages/core/src/utils/IntelliSenseApi.ts#L50)

Parse SQL up to cursor position with error recovery

Combines position-aware parsing with error recovery to handle incomplete SQL
that users are actively typing. Ideal for providing IntelliSense in editors.

## Parameters

### sql

`string`

SQL text to parse

### cursorPosition

Cursor position (character offset or line/column)

`number` | [`LineColumn`](../interfaces/LineColumn.md)

### options

[`ParseToPositionOptions`](../interfaces/ParseToPositionOptions.md) = `{}`

Parsing options including error recovery settings

## Returns

[`PositionParseResult`](../interfaces/PositionParseResult.md)

Parse result with position-specific information
</div>
